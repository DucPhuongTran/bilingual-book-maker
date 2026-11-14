import { createWorker } from 'tesseract.js';
import './style.css';

const fileInput = document.querySelector('#file');
const dropZone = document.querySelector('#drop-zone');
const preview = document.querySelector('#preview');
const pageSelect = document.querySelector('#page');
const pageLabel = document.querySelector('#page-label');
const pageActions = document.querySelector('#page-actions');
const moveUp = document.querySelector('#move-up');
const moveDown = document.querySelector('#move-down');
const remove = document.querySelector('#remove');
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

const pages = [];
const filenameOrder = new Intl.Collator('vi', { numeric: true });
let selectedIndex = -1;
let previewUrl;
let busy = false;

function combinedText() {
  return pages.map(({ text }) => text.trim()).filter(Boolean).join('\n\n');
}

function updateControls() {
  const hasPage = selectedIndex >= 0;
  fileInput.disabled = busy;
  pageSelect.disabled = busy;
  language.disabled = busy;
  recognize.disabled = busy || !pages.some(({ complete }) => !complete);
  moveUp.disabled = busy || selectedIndex <= 0;
  moveDown.disabled = busy || !hasPage || selectedIndex >= pages.length - 1;
  remove.disabled = busy || !hasPage;
  result.readOnly = busy || !hasPage;
  copy.disabled = save.disabled = busy || !pages.some(({ text }) => text.trim());
}

function showPage() {
  const page = pages[selectedIndex];
  pageSelect.replaceChildren(...pages.map(({ file, complete }, index) =>
    new Option(`${index + 1}. ${file.name || 'Ảnh đã dán'}${complete ? '' : ' — chưa nhận dạng'}`, index),
  ));
  if (page) pageSelect.value = selectedIndex;
  pageSelect.hidden = pageLabel.hidden = pageActions.hidden = preview.hidden = !page;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = page ? URL.createObjectURL(page.file) : undefined;
  if (previewUrl) preview.src = previewUrl;
  else preview.removeAttribute('src');
  result.value = page?.text ?? '';
  result.scrollTop = 0;
  outputStatus.textContent = '';
  updateControls();
}

function addFiles(files) {
  if (busy || !files.length) return;
  const supported = [...files].filter((file) => imageTypes.has(file.type) && file.size);
  if (!supported.length) {
    status.textContent = 'Hãy chọn ảnh PNG, JPEG hoặc WebP hợp lệ.';
    return;
  }
  if (selectedIndex < 0) selectedIndex = 0;
  supported.sort((a, b) => filenameOrder.compare(a.name, b.name));
  pages.push(...supported.map((file) => ({ file, text: '', complete: false })));
  const skipped = files.length - supported.length;
  status.textContent = skipped
    ? `Đã thêm ${supported.length} ảnh, bỏ qua ${skipped} tệp không hợp lệ.`
    : `Đã thêm ${supported.length} ảnh. Tổng cộng ${pages.length} trang.`;
  showPage();
}

function movePage(offset) {
  const target = selectedIndex + offset;
  if (busy || !pages[selectedIndex] || !pages[target]) return;
  [pages[selectedIndex], pages[target]] = [pages[target], pages[selectedIndex]];
  selectedIndex = target;
  showPage();
}

pageSelect.addEventListener('change', () => {
  selectedIndex = Number(pageSelect.value);
  showPage();
});
moveUp.addEventListener('click', () => movePage(-1));
moveDown.addEventListener('click', () => movePage(1));
remove.addEventListener('click', () => {
  if (busy || selectedIndex < 0) return;
  pages.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, pages.length - 1);
  status.textContent = pages.length ? `Còn ${pages.length} trang.` : 'Chọn ảnh để bắt đầu.';
  showPage();
});

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});
dropZone.addEventListener('dragover', (event) => event.preventDefault());
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  addFiles(event.dataTransfer.files);
});
document.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files ?? [])].filter((file) => imageTypes.has(file.type));
  if (!files.length || busy) return;
  event.preventDefault();
  addFiles(files);
});

recognize.addEventListener('click', async () => {
  if (busy) return;
  const pending = pages.filter(({ complete }) => !complete);
  if (!pending.length) return;
  let processed = 0;
  let failed = 0;
  busy = true;
  updateControls();
  outputStatus.textContent = '';
  progress.max = pending.length;
  progress.removeAttribute('value');
  progress.hidden = false;
  status.textContent = 'Đang chuẩn bị bộ nhận dạng…';

  let worker;
  try {
    // Tesseract can report initialization errors before its worker promise settles.
    let rejectWorker;
    const workerFailure = new Promise((_, reject) => { rejectWorker = reject; });
    worker = await Promise.race([workerFailure, createWorker(language.value, undefined, {
      workerPath: new URL('worker.min.js', assets).href,
      corePath: new URL('tesseract-core-lstm.wasm.js', assets).href,
      langPath: assets.href,
      workerBlobURL: false,
      errorHandler: rejectWorker,
      logger(message) {
        if (message.status !== 'recognizing text') return;
        progress.value = processed + message.progress;
        status.textContent = `Đang nhận dạng trang ${pages.indexOf(pending[processed]) + 1}/${pages.length}… ${Math.round(message.progress * 100)}%`;
      },
    })]);
    for (const page of pending) {
      status.textContent = `Đang xử lý trang ${pages.indexOf(page) + 1}/${pages.length}…`;
      try {
        const { data } = await worker.recognize(page.file);
        page.text = data.text.trim();
        page.complete = true;
      } catch (error) {
        console.error(error);
        failed += 1;
      }
      processed += 1;
      progress.value = processed;
    }
    status.textContent = failed
      ? `Hoàn tất ${processed - failed}/${processed} trang. Bấm nhận dạng để thử lại các trang lỗi.`
      : `Đã xử lý ${processed} trang. ${pending.filter(({ text }) => !text).length} trang không tìm thấy chữ.`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Nhận dạng thất bại. Hãy kiểm tra ảnh, tải lại trang rồi thử lại.';
  } finally {
    try {
      await worker?.terminate();
    } finally {
      progress.hidden = true;
      busy = false;
      showPage();
    }
  }
});

result.addEventListener('input', () => {
  const page = pages[selectedIndex];
  if (page) page.text = result.value;
  outputStatus.textContent = '';
  updateControls();
});
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(combinedText());
    outputStatus.textContent = 'Đã sao chép văn bản.';
  } catch {
    outputStatus.textContent = 'Trình duyệt không thể sao chép toàn bộ. Bạn có thể dùng nút Tải TXT toàn bộ.';
  }
});
save.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([combinedText()], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'van-ban.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
