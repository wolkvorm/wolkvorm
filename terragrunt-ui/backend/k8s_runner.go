package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// KubeJobOpts holds options for creating a Kubernetes Job.
type KubeJobOpts struct {
	Name      string            // unique job name
	Image     string            // container image (e.g. terraforge-runner)
	Command   []string          // entrypoint command
	Args      []string          // command arguments
	EnvVars   map[string]string // environment variables
	HCLContent string           // main.tf content to mount
	Namespace string            // kubernetes namespace
}

// getExecutionMode returns the current execution mode ("docker" or "kubernetes").
func getExecutionMode() string {
	mode := os.Getenv("EXECUTION_MODE")
	if mode == "kubernetes" || mode == "k8s" {
		return "kubernetes"
	}
	return "docker"
}

// getRunnerImage returns the runner image from env or default.
func getRunnerImage() string {
	img := os.Getenv("RUNNER_IMAGE")
	if img != "" {
		return img
	}
	return "wolkvorm-runner"
}

// getRunnerNamespace returns the namespace for Jobs.
func getRunnerNamespace() string {
	ns := os.Getenv("RUNNER_NAMESPACE")
	if ns != "" {
		return ns
	}
	// Try to read from the mounted service account
	data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
	if err == nil && len(data) > 0 {
		return strings.TrimSpace(string(data))
	}
	return "default"
}

// getKubeClient creates a Kubernetes clientset using in-cluster config.
func getKubeClient() (*kubernetes.Clientset, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}
	return clientset, nil
}

// RunKubeJob creates a Kubernetes Job, waits for it to complete, and returns the logs.
func RunKubeJob(opts KubeJobOpts) (string, error) {
	client, err := getKubeClient()
	if err != nil {
		return "", err
	}

	ctx := context.Background()
	ns := opts.Namespace
	if ns == "" {
		ns = getRunnerNamespace()
	}

	// Create ConfigMap with main.tf
	cmName := opts.Name + "-hcl"
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: ns,
			Labels: map[string]string{
				"app":        "wolkvorm",
				"managed-by": "wolkvorm-runner",
				"job-name":   opts.Name,
			},
		},
		Data: map[string]string{
			"main.tf": opts.HCLContent,
		},
	}
	_, err = client.CoreV1().ConfigMaps(ns).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create configmap: %w", err)
	}

// Cleanup on exit
defer func() {
	_ = client.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
	dp := metav1.DeletePropagationBackground
	_ = client.BatchV1().Jobs(ns).Delete(ctx, opts.Name, metav1.DeleteOptions{
		PropagationPolicy: &dp,
	})
}()

// Build env vars
envVars := []corev1.EnvVar{}
for k, v := range opts.EnvVars {
	envVars = append(envVars, corev1.EnvVar{Name: k, Value: v})
}

// Build Job spec
backoffLimit := int32(0)
ttl := int32(300) // auto-cleanup after 5 minutes
job := &batchv1.Job{
	ObjectMeta: metav1.ObjectMeta{
		Name:      opts.Name,
		Namespace: ns,
		Labels: map[string]string{
			"app":        "wolkvorm",
			"managed-by": "wolkvorm-runner",
		},
	},
	Spec: batchv1.JobSpec{
		BackoffLimit:            &backoffLimit,
		TTLSecondsAfterFinished: &ttl,
		Template: corev1.PodTemplateSpec{
			ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{
					"app":      "wolkvorm",
					"job-name": opts.Name,
				},
			},
			Spec: corev1.PodSpec{
				RestartPolicy: corev1.RestartPolicyNever,
				Containers: []corev1.Container{
					{
						Name:    "runner",
						Image:   opts.Image,
						Command: opts.Command,
						Args:    opts.Args,
						Env:     envVars,
						VolumeMounts: []corev1.VolumeMount{
							{
								Name:      "hcl-config",
								MountPath: "/workspace/main.tf",
								SubPath:   "main.tf",
							},
						},
							WorkingDir: "/workspace",
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "hcl-config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: cmName,
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create the Job
	_, err = client.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create job: %w", err)
	}

	// Wait for the Job to complete
	logs, err := waitForJobAndGetLogs(client, ns, opts.Name, nil)
	if err != nil {
		return logs, err
	}

	return logs, nil
}

// RunKubeJobStreaming creates a Kubernetes Job and streams logs to a channel.
func RunKubeJobStreaming(opts KubeJobOpts, logCh chan<- string) error {
	client, err := getKubeClient()
	if err != nil {
		return err
	}

	ctx := context.Background()
	ns := opts.Namespace
	if ns == "" {
		ns = getRunnerNamespace()
	}

	// Create ConfigMap with main.tf
	cmName := opts.Name + "-hcl"
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: ns,
			Labels: map[string]string{
				"app":        "wolkvorm",
				"managed-by": "wolkvorm-runner",
				"job-name":   opts.Name,
			},
		},
		Data: map[string]string{
			"main.tf": opts.HCLContent,
		},
	}
	_, err = client.CoreV1().ConfigMaps(ns).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create configmap: %w", err)
	}

// Cleanup on exit
defer func() {
	_ = client.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
	dp := metav1.DeletePropagationBackground
	_ = client.BatchV1().Jobs(ns).Delete(ctx, opts.Name, metav1.DeleteOptions{
		PropagationPolicy: &dp,
	})
}()

// Build env vars
envVars := []corev1.EnvVar{}
for k, v := range opts.EnvVars {
	envVars = append(envVars, corev1.EnvVar{Name: k, Value: v})
}

// Build Job spec
backoffLimit := int32(0)
ttl := int32(300)
job := &batchv1.Job{
	ObjectMeta: metav1.ObjectMeta{
		Name:      opts.Name,
		Namespace: ns,
		Labels: map[string]string{
			"app":        "wolkvorm",
			"managed-by": "wolkvorm-runner",
		},
	},
	Spec: batchv1.JobSpec{
		BackoffLimit:            &backoffLimit,
		TTLSecondsAfterFinished: &ttl,
		Template: corev1.PodTemplateSpec{
			ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{
					"app":      "wolkvorm",
					"job-name": opts.Name,
				},
			},
			Spec: corev1.PodSpec{
				RestartPolicy: corev1.RestartPolicyNever,
				Containers: []corev1.Container{
					{
						Name:    "runner",
						Image:   opts.Image,
						Command: opts.Command,
						Args:    opts.Args,
						Env:     envVars,
						VolumeMounts: []corev1.VolumeMount{
							{
								Name:      "hcl-config",
								MountPath: "/workspace/main.tf",
								SubPath:   "main.tf",
							},
						},
							WorkingDir: "/workspace",
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "hcl-config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: cmName,
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create the Job
	_, err = client.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create job: %w", err)
	}

	// Stream logs
	_, err = waitForJobAndGetLogs(client, ns, opts.Name, logCh)
	return err
}

// waitForJobAndGetLogs waits for a Job's pod to be ready, streams logs, and waits for completion.
// If logCh is not nil, logs are sent line-by-line; otherwise they're accumulated and returned.
func waitForJobAndGetLogs(client *kubernetes.Clientset, namespace, jobName string, logCh chan<- string) (string, error) {
	ctx := context.Background()

	// Wait for the pod to be created and running
	var podName string
	for i := 0; i < 120; i++ { // max 2 minutes to wait for pod
		pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("job-name=%s", jobName),
		})
		if err == nil && len(pods.Items) > 0 {
			pod := pods.Items[0]
			podName = pod.Name
			if pod.Status.Phase == corev1.PodRunning ||
				pod.Status.Phase == corev1.PodSucceeded ||
				pod.Status.Phase == corev1.PodFailed {
				break
			}
		}
		time.Sleep(1 * time.Second)
	}

	if podName == "" {
		return "", fmt.Errorf("timeout waiting for job pod to start")
	}

	// Stream logs
	follow := true
	logOpts := &corev1.PodLogOptions{
		Container: "runner",
		Follow:    follow,
	}

	req := client.CoreV1().Pods(namespace).GetLogs(podName, logOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to stream logs: %w", err)
	}
	defer stream.Close()

	var allLogs string
	scanner := bufio.NewScanner(stream)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		allLogs += line + "\n"
		if logCh != nil {
			logCh <- line
		}
	}

	// Wait for Job to finish and check status
	for i := 0; i < 30; i++ {
		job, err := client.BatchV1().Jobs(namespace).Get(ctx, jobName, metav1.GetOptions{})
		if err != nil {
			break
		}
		if job.Status.Succeeded > 0 {
			return allLogs, nil
		}
		if job.Status.Failed > 0 {
			return allLogs, fmt.Errorf("job failed")
		}
		time.Sleep(1 * time.Second)
	}

	return allLogs, nil
}

// RunKubeJobForCost runs an Infracost container as a Kubernetes Job.
func RunKubeJobForCost(image string, envVars map[string]string, hclContent string) (string, string, error) {
	client, err := getKubeClient()
	if err != nil {
		return "", "", err
	}

	ctx := context.Background()
	ns := getRunnerNamespace()
	jobName := fmt.Sprintf("wolkvorm-cost-%d", time.Now().UnixMilli())
	cmName := jobName + "-hcl"

	// Create ConfigMap
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: ns,
		Labels: map[string]string{
			"app":        "wolkvorm",
			"managed-by": "wolkvorm-runner",
		},
	},
	Data: map[string]string{
		"main.tf": hclContent,
	},
	}
	_, err = client.CoreV1().ConfigMaps(ns).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		return "", "", fmt.Errorf("failed to create configmap: %w", err)
	}

	defer func() {
		_ = client.CoreV1().ConfigMaps(ns).Delete(ctx, cmName, metav1.DeleteOptions{})
		dp := metav1.DeletePropagationBackground
		_ = client.BatchV1().Jobs(ns).Delete(ctx, jobName, metav1.DeleteOptions{
			PropagationPolicy: &dp,
		})
	}()

	// Build env vars
	envs := []corev1.EnvVar{}
	for k, v := range envVars {
		envs = append(envs, corev1.EnvVar{Name: k, Value: v})
	}

	backoffLimit := int32(0)
	ttl := int32(120)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: ns,
			Labels: map[string]string{
				"app":        "wolkvorm",
				"managed-by": "wolkvorm-runner",
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttl,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":      "wolkvorm",
						"job-name": jobName,
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:    "infracost",
							Image:   image,
							Command: []string{"infracost"},
							Args:    []string{"breakdown", "--path", "/workspace", "--format", "json"},
							Env:     envs,
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "workspace",
									MountPath: "/workspace/main.tf",
									SubPath:   "main.tf",
								},
							},
							WorkingDir: "/workspace",
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "workspace",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: cmName,
									},
								},
							},
						},
					},
				},
			},
		},
	}

	_, err = client.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return "", "", fmt.Errorf("failed to create cost job: %w", err)
	}

	// Wait for pod and get logs
	var podName string
	for i := 0; i < 120; i++ {
		pods, perr := client.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("job-name=%s", jobName),
		})
		if perr == nil && len(pods.Items) > 0 {
			pod := pods.Items[0]
			podName = pod.Name
			if pod.Status.Phase == corev1.PodRunning ||
				pod.Status.Phase == corev1.PodSucceeded ||
				pod.Status.Phase == corev1.PodFailed {
				break
			}
		}
		time.Sleep(1 * time.Second)
	}

	if podName == "" {
		return "", "", fmt.Errorf("timeout waiting for cost job pod")
	}

	// Get logs (stdout only - infracost writes JSON to stdout)
	logOpts := &corev1.PodLogOptions{Container: "infracost"}
	req := client.CoreV1().Pods(ns).GetLogs(podName, logOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to get cost logs: %w", err)
	}
	defer stream.Close()
	logData, _ := io.ReadAll(stream)

	return string(logData), "", nil
}
