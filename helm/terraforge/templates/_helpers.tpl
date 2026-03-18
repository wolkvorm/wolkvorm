{{/*
Common labels
*/}}
{{- define "terraforge.labels" -}}
app.kubernetes.io/name: terraforge
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Service account name
*/}}
{{- define "terraforge.serviceAccountName" -}}
{{- if .Values.serviceAccount.name }}
{{- .Values.serviceAccount.name }}
{{- else }}
{{- .Release.Name }}-terraforge
{{- end }}
{{- end }}
