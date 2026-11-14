import { createWorker } from 'tesseract.js';
import './style.css';
import { readProject, writeProject, exportProject, importProject } from './project.js';

const bookTitle = document.querySelector('#book-title');
const backup = document.querySelector('#backup');
const restore = document.querySelector('#restore');
const newProject = document.querySelector('#new-project');
const storageStatus = document.querySelector('#storage-status');
let saveTimer;
let saveQueue = Promise.resolve();
let revision = 0;
let restoring = true;

function projectSnapshot() {
  return { title: bookTitle.value, language: language.value,
    pages: pages.map(page => ({ ...page })) };
}

function persistProject() {
  if (restoring) return;
  clearTimeout(saveTimer);
  const snapshot = projectSnapshot();
  const currentRevision = ++revision;
  storageStatus.textContent = 'Đang lưu trên thiết bị…';
  saveQueue = saveQueue.catch(() => {}).then(() => writeProject(snapshot)).then(() => {
    if (currentRevision === revision) storageStatus.textContent = 'Đã lưu trên thiết bị.';
  }).catch((error) => {
    console.error(error);
    if (currentRevision === revision) storageStatus.textContent =
      'Không thể lưu trên thiết bị. Hãy tải bản sao dự án để giữ dữ liệu.';
  });
  return saveQueue;
}

function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
let busy = true;

function combinedText() {
  return pages.map(({ text }) => text.trim()).filter(Boolean).join('\n\n');
}

function updateControls() {
  const hasPage = selectedIndex >= 0;
  bookTitle.disabled = busy;
  backup.disabled = busy;
  restore.disabled = busy;
  newProject.disabled = busy;
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
  persistProject();
}

function movePage(offset) {
  const target = selectedIndex + offset;
  if (busy || !pages[selectedIndex] || !pages[target]) return;
  [pages[selectedIndex], pages[target]] = [pages[target], pages[selectedIndex]];
  selectedIndex = target;
  showPage();
  persistProject();
}

pageSelect.addEventListener('change', () => {
  selectedIndex = Number(pageSelect.value);
  showPage();
  persistProject();
});
moveUp.addEventListener('click', () => movePage(-1));
moveDown.addEventListener('click', () => movePage(1));
remove.addEventListener('click', () => {
  if (busy || selectedIndex < 0) return;
  if (!confirm('Xóa trang đang xem và văn bản của trang này?')) return;
  pages.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, pages.length - 1);
  status.textContent = pages.length ? `Còn ${pages.length} trang.` : 'Chọn ảnh để bắt đầu.';
  showPage();
  persistProject();
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
        persistProject();
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
  storageStatus.textContent = 'Đang chờ lưu…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistProject, 300);
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
  download(combinedText(), (bookTitle.value.trim() || 'van-ban') + '.txt', 'text/plain;charset=utf-8');
});
bookTitle.addEventListener('input', persistProject);
language.addEventListener('change', persistProject);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistProject();
});

backup.addEventListener('click', async () => {
  busy = true;
  updateControls();
  try {
    download(await exportProject(projectSnapshot()), 'book-project.json', 'application/json');
    outputStatus.textContent = 'Đã tạo bản sao dự án gồm ảnh và văn bản.';
  } catch (error) {
    console.error(error);
    outputStatus.textContent = 'Không thể tạo bản sao dự án. Hãy thử chia sách thành các dự án nhỏ hơn.';
  } finally {
    busy = false;
    updateControls();
  }
});

function applyProject(project) {
  pages.splice(0, pages.length, ...project.pages);
  bookTitle.value = project.title;
  language.value = project.language;
  selectedIndex = pages.length ? 0 : -1;
  showPage();
}

restore.addEventListener('change', async () => {
  const file = restore.files[0];
  restore.value = '';
  if (!file || busy) return;
  busy = true;
  updateControls();
  try {
    const project = importProject(await file.text());
    if (pages.length && !confirm('Thay dự án hiện tại bằng bản sao này? Hãy tải bản sao dự án hiện tại trước nếu cần giữ lại.')) return;
    applyProject(project);
    persistProject();
    status.textContent = 'Đã mở bản sao dự án.';
  } catch (error) {
    console.error(error);
    status.textContent = 'Không thể mở dự án. Hãy chọn bản sao JSON được tải từ ứng dụng.';
  } finally {
    busy = false;
    updateControls();
  }
});

newProject.addEventListener('click', () => {
  if (pages.length && !confirm('Tạo dự án mới sẽ thay dự án hiện tại trên thiết bị. Bạn đã tải bản sao cần giữ chưa?')) return;
  applyProject({ title: '', language: 'eng', pages: [] });
  persistProject();
  status.textContent = 'Chọn ảnh để bắt đầu.';
});

updateControls();
try {
  const stored = await readProject();
  if (stored) applyProject(stored);
  storageStatus.textContent = stored ? 'Đã mở dự án lưu trên thiết bị.' : 'Sẵn sàng tự lưu trên thiết bị.';
} catch (error) {
  console.error(error);
  storageStatus.textContent = 'Không thể mở bộ nhớ trình duyệt. Hãy dùng bản sao dự án để giữ dữ liệu.';
} finally {
  restoring = false;
  busy = false;
  updateControls();
}
