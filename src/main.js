import { createWorker } from 'tesseract.js';
import './style.css';

const fileInput = document.querySelector('#file');
const dropZone = document.querySelector('#drop-zone');
const preview = document.querySelector('#preview');
const filename = document.querySelector('#filename');
const language = document.querySelector('#language');
const recognize = document.querySelector('#recognize');
const progress = document.querySelector('#progress');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const copy = document.querySelector('#copy');
const save = document.querySelector('#save');
const outputStatus = document.querySelector('#output-status');
const assets = new URL(`${import.meta.env.BASE_URL}ocr/`, document.baseURI);
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

let selectedFile;
let previewUrl;
let busy = false;

function updateControls() {
  fileInput.disabled = busy;
  language.disabled = busy;
  recognize.disabled = busy || !selectedFile;
  result.readOnly = busy;
  copy.disabled = save.disabled = busy || !result.value.trim();
}

function selectFile(file) {
  if (busy || !file) return;
  if (!imageTypes.has(file.type) || !file.size) {
    status.textContent = 'Hãy chọn ảnh PNG, JPEG hoặc WebP hợp lệ.';
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  filename.textContent = file.name || 'Ảnh đã dán';
  filename.hidden = false;
  result.value = '';
  outputStatus.textContent = '';
  status.textContent = 'Ảnh đã sẵn sàng.';
  updateControls();
}

fileInput.addEventListener('change', () => {
  selectFile(fileInput.files[0]);
  fileInput.value = '';
});
dropZone.addEventListener('dragover', (event) => event.preventDefault());
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  selectFile(event.dataTransfer.files[0]);
});
document.addEventListener('paste', (event) => {
  const file = [...(event.clipboardData?.files ?? [])].find((item) => imageTypes.has(item.type));
  if (!file || busy) return;
  event.preventDefault();
  selectFile(file);
});

recognize.addEventListener('click', async () => {
  if (busy || !selectedFile) return;
  busy = true;
  updateControls();
  outputStatus.textContent = '';
  progress.removeAttribute('value');
  progress.hidden = false;
  status.textContent = 'Đang chuẩn bị bộ nhận dạng…';

  let worker;
  try {
    // Tesseract can report initialization errors before its worker promise settles.
    const workerFailure = Promise.withResolvers();
    worker = await Promise.race([workerFailure.promise, createWorker(language.value, undefined, {
      workerPath: new URL('worker.min.js', assets).href,
      corePath: new URL('tesseract-core-lstm.wasm.js', assets).href,
      langPath: assets.href,
      workerBlobURL: false,
      errorHandler: workerFailure.reject,
      logger(message) {
        if (message.status !== 'recognizing text') return;
        progress.value = message.progress;
        status.textContent = `Đang nhận dạng… ${Math.round(message.progress * 100)}%`;
      },
    })]);
    const { data } = await worker.recognize(selectedFile);
    result.value = data.text.trim();
    status.textContent = result.value ? 'Đã nhận dạng xong.' : 'Không tìm thấy chữ trong ảnh.';
  } catch (error) {
    console.error(error);
    status.textContent = 'Nhận dạng thất bại. Hãy kiểm tra ảnh, tải lại trang rồi thử lại.';
  } finally {
    try {
      await worker?.terminate();
    } finally {
      progress.hidden = true;
      busy = false;
      updateControls();
    }
  }
});

result.addEventListener('input', () => {
  outputStatus.textContent = '';
  updateControls();
});
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(result.value);
    outputStatus.textContent = 'Đã sao chép văn bản.';
  } catch {
    result.focus();
    result.select();
    outputStatus.textContent = 'Văn bản đã được chọn. Hãy dùng lệnh Sao chép trên thiết bị.';
  }
});
save.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([result.value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'van-ban.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
