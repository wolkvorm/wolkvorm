const Jimp = require('jimp');

async function processImage() {
    const img = await Jimp.read('/Users/ismailensarkol/.gemini/antigravity/brain/12091466-a770-4094-9a26-cb7e637fe3f2/terraforge_logo_raw_1771806610452.png');

    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];

        // Calculate alpha based on brightness (max channel)
        const alpha = Math.max(r, g, b);

        if (alpha > 0) {
            // Restore original color scaled by alpha
            this.bitmap.data[idx + 0] = Math.min(255, (r / alpha) * 255);
            this.bitmap.data[idx + 1] = Math.min(255, (g / alpha) * 255);
            this.bitmap.data[idx + 2] = Math.min(255, (b / alpha) * 255);
            this.bitmap.data[idx + 3] = alpha; // Set calculated alpha
        } else {
            this.bitmap.data[idx + 3] = 0; // Pure black becomes fully transparent
        }
    });

    await img.writeAsync('/Users/ismailensarkol/grandform/terragrunt-ui/frontend/src/assets/logo-terraforge-transparent.png');
    console.log('Saved transparent logo successfully.');
}

processImage().catch(console.error);
