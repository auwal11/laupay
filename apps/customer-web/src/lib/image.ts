export function compressProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { reject(new Error("Choose a JPG, PNG or WebP image up to 5MB.")); return; }
    const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read image.")); reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error("Invalid image.")); image.onload = () => { const scale = Math.min(1, 900 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.82)); }; image.src = String(reader.result); }; reader.readAsDataURL(file);
  });
}
