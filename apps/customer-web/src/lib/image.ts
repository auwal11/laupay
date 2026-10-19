export function compressProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      reject(new Error("Choose a JPG, PNG or WebP image up to 5MB."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Invalid image."));
    };
    image.onload = () => {
      try {
        // Profile photos are avatars, so keeping the payload small prevents
        // mobile uploads from being rejected by the API/proxy body limit.
        const maxDimension = 640;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare image.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        // Keep the encoded payload comfortably below the server limit.
        while (dataUrl.length * 0.75 > 900 * 1024 && quality > 0.45) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        URL.revokeObjectURL(objectUrl);
        if (dataUrl.length * 0.75 > 900 * 1024) {
          reject(new Error("This image could not be compressed enough. Please choose a smaller image."));
          return;
        }
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not prepare image."));
      }
    };
    image.src = objectUrl;
  });
}
