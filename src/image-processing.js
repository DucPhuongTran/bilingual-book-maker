export const defaultProcessing = { top: 0, bottom: 0, left: 0, right: 0, invert: false, contrast: 1 };

export function validateProcessing(value = defaultProcessing) {
  const result = Object.fromEntries(Object.entries(defaultProcessing).map(([key, fallback]) =>
    [key, value?.[key] ?? fallback],
  ));
  for (const key of ['top', 'bottom', 'left', 'right']) {
    if (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > 45) throw new Error('Lề cắt phải từ 0 đến 45%.');
  }
  if (typeof result.invert !== 'boolean' || ![1, 1.5, 2].includes(result.contrast)) {
    throw new Error('Thiết lập xử lý ảnh không hợp lệ.');
  }
  return result;
}

export function cropRectangle(width, height, options) {
  const settings = validateProcessing(options);
  const x = Math.floor(width * settings.left / 100);
  const y = Math.floor(height * settings.top / 100);
  return { x, y, width: Math.max(1, width - x - Math.floor(width * settings.right / 100)),
    height: Math.max(1, height - y - Math.floor(height * settings.bottom / 100)) };
}

export function adjustPixels(data, settings) {
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      let value = data[index + channel] * alpha + 255 * (1 - alpha);
      if (settings.invert) value = 255 - value;
      data[index + channel] = Math.max(0, Math.min(255, (value - 128) * settings.contrast + 128));
    }
    data[index + 3] = 255;
  }
}

export async function prepareImage(file, options) {
  const settings = validateProcessing(options);
  if (!settings.top && !settings.bottom && !settings.left && !settings.right && !settings.invert && settings.contrast === 1) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const crop = cropRectangle(bitmap.width, bitmap.height, settings);
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Không thể xử lý ảnh trên trình duyệt này.');
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    if (settings.invert || settings.contrast !== 1) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      adjustPixels(pixels.data, settings);
      context.putImageData(pixels, 0, 0);
    }
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Không thể tạo ảnh xử lý.'));
    }, 'image/png'));
  } finally {
    bitmap.close();
  }
}
