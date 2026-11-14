import { createWorker } from 'tesseract.js';
import './style.css';
import { defaultProcessing, validateProcessing, prepareImage } from './image-processing.js';
import { translateWithClaude, translationContext } from './claude.js';
const processingPanel = document.querySelector('#processing-panel');
const cropInputs = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(side => [side, document.querySelector('#crop-' + side)]));
const invertImage = document.querySelector('#invert-image');
const imageContrast = document.querySelector('#image-contrast');
const resetProcessing = document.querySelector('#reset-processing');
const processingStatus = document.querySelector('#processing-status');
const processedPreview = document.querySelector('#processed-preview');
const recognizeAgain = document.querySelector('#recognize-again');
let processing = { ...defaultProcessing };
let imagePreviewVersion = 0;
let processedUrl;
let imagePreviewTimer;
const claudeKey = document.querySelector('#claude-key');
const claudeModel = document.querySelector('#claude-model');
const clearKey = document.querySelector('#clear-key');
const translatePage = document.querySelector('#translate-page');
const translateMissing = document.querySelector('#translate-missing');
const stopTranslation = document.querySelector('#stop-translation');
const claudeStatus = document.querySelector('#claude-status');
let translationController;

async function updateImagePreview() {
  const version = ++imagePreviewVersion;
  processedPreview.hidden = true;
  if (processedUrl) URL.revokeObjectURL(processedUrl);
  processedUrl = undefined;
  if (!processingPanel.open || !pages[selectedIndex]) return;
  processingStatus.textContent = 'Đang tạo ảnh xem trước…';
  try {
    const blob = await prepareImage(pages[selectedIndex].file, processing);
    if (version !== imagePreviewVersion) return;
    processedUrl = URL.createObjectURL(blob);
    processedPreview.src = processedUrl;
    processedPreview.hidden = false;
    processingStatus.textContent = 'Ảnh sau xử lý sẽ được dùng cho OCR.';
  } catch (error) {
    if (version === imagePreviewVersion) processingStatus.textContent = 'Không thể xử lý ảnh này. Hãy kiểm tra ảnh hoặc đặt lại thiết lập.';
  }
}

function setProcessingControls() {
  for (const [side, input] of Object.entries(cropInputs)) input.value = processing[side];
  invertImage.checked = processing.invert;
  imageContrast.value = processing.contrast;
}

function changeProcessing() {
  if (busy) return;
  try {
    const candidate = Object.fromEntries(Object.entries(cropInputs).map(([side, input]) => [side, input.valueAsNumber]));
    processing = validateProcessing({ ...candidate, invert: invertImage.checked, contrast: Number(imageContrast.value) });
    persistProject();
    clearTimeout(imagePreviewTimer);
    imagePreviewVersion += 1;
    processedPreview.hidden = true;
    imagePreviewTimer = setTimeout(updateImagePreview, 200);
  } catch (error) {
    processingStatus.textContent = error.message;
    setProcessingControls();
  }
}
for (const input of [...Object.values(cropInputs), invertImage, imageContrast]) input.addEventListener('change', changeProcessing);
processingPanel.addEventListener('toggle', updateImagePreview);
resetProcessing.addEventListener('click', () => {
  if (busy) return;
  processing = { ...defaultProcessing };
  setProcessingControls();
  persistProject();
  updateImagePreview();
});

async function runTranslation(batch) {
  if (busy || !batch.length || !claudeKey.value.trim() || !claudeModel.value.trim()) return;
  busy = true;
  translationController = new AbortController();
  const apiKey = claudeKey.value;
  const model = claudeModel.value;
  updateControls();
  let completed = 0;
  const timeout = setTimeout(() => translationController?.abort(), 20 * 60 * 1000);
  try {
    for (const page of batch) {
      const index = pages.indexOf(page);
      claudeStatus.textContent = `Đang dịch trang ${index + 1}. đã xong ${completed}/${batch.length}.`;
      const translated = await translateWithClaude({ text: page.text, context: translationContext(pages, index), apiKey, model, signal: translationController.signal });
      if (translationController.signal.aborted) break;
      page.translation = translated;
      completed += 1;
      persistProject();
      if (pages[selectedIndex] === page) {
        translation.value = translated;
        updatePreview();
      }
    }
    claudeStatus.textContent = `Đã dịch ${completed}/${batch.length} trang. Kiểm tra bản xem trước để soát nội dung.`;
  } catch (error) {
    claudeStatus.textContent = translationController.signal.aborted
      ? `Đã dừng. Giữ lại ${completed} trang dịch xong. Yêu cầu đã gửi có thể vẫn tính phí.`
      : `Đã lưu ${completed} trang. ${error.message}`;
  } finally {
    clearTimeout(timeout);
    translationController = undefined;
    busy = false;
    updateControls();
  }
}
claudeKey.addEventListener('input', updateControls);
claudeModel.addEventListener('input', updateControls);
clearKey.addEventListener('click', () => { claudeKey.value = ''; updateControls(); });
stopTranslation.addEventListener('click', () => translationController?.abort());
translatePage.addEventListener('click', () => {
  const page = pages[selectedIndex];
  if (!page?.text.trim()) return;
  if (page.translation?.trim() && !confirm('Dịch lại sẽ thay bản dịch hiện tại của trang này. Tiếp tục?')) return;
  runTranslation([page]);
});
translateMissing.addEventListener('click', () => runTranslation(pages.filter(page => page.text.trim() && !page.translation?.trim())));

import { pageSegments, splitParagraphs } from './bilingual.js';
import { makePrc } from './prc.js';
import { makeEpub } from './ebook.js';
const translation = document.querySelector('#translation');
const translationPrompt = document.querySelector('#translation-prompt');
const prc = document.querySelector('#prc');
const layout = document.querySelector('#layout');
const alignmentStatus = document.querySelector('#alignment-status');
const bilingualPreview = document.querySelector('#bilingual-preview');
const previewBook = document.querySelector('#preview-book');

function updatePreview() {
  const page = pages[selectedIndex];
  bilingualPreview.replaceChildren();
  if (!page) { alignmentStatus.textContent = ''; return; }
  const originals = splitParagraphs(page.text);
  const translations = splitParagraphs(page.translation);
  alignmentStatus.textContent = layout.value === 'paragraph' && originals.length !== translations.length
    ? `Có ${originals.length} đoạn gốc và ${translations.length} đoạn dịch. Trang này sẽ xuất nguyên văn trước, bản dịch sau cho đến khi số đoạn khớp.`
    : `${originals.length} đoạn gốc, ${translations.length} đoạn dịch.`;
  if (!previewBook.open) return;
  for (const segment of pageSegments(page, layout.value)) {
    const paragraph = document.createElement('p');
    paragraph.textContent = segment.text;
    if (segment.translated) paragraph.className = 'translation';
    bilingualPreview.append(paragraph);
  }
}
previewBook.addEventListener('toggle', updatePreview);
const epub = document.querySelector('#epub');
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
  return { title: bookTitle.value, language: language.value, layout: layout.value, processing: { ...processing },
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
  return pages.map(page => pageSegments(page, layout.value).map(segment => segment.text).join('\n\n')).filter(Boolean).join('\n\n');
}

function updateControls() {
  const hasPage = selectedIndex >= 0;
  for (const input of [...Object.values(cropInputs), invertImage, imageContrast, resetProcessing]) input.disabled = busy;
  recognizeAgain.disabled = busy || !pages.length;
  claudeKey.disabled = claudeModel.disabled = clearKey.disabled = busy;
  const canTranslate = !busy && claudeKey.value.trim() && claudeModel.value.trim();
  translatePage.disabled = !canTranslate || !pages[selectedIndex]?.text.trim();
  translateMissing.disabled = !canTranslate || !pages.some(page => page.text.trim() && !page.translation?.trim());
  stopTranslation.disabled = !translationController;
  layout.disabled = busy;
  bookTitle.disabled = busy;
  backup.disabled = busy;
  restore.disabled = busy;
  newProject.disabled = busy;
  translation.readOnly = busy || !hasPage;
  translationPrompt.disabled = busy || !pages[selectedIndex]?.text.trim();
  prc.disabled = epub.disabled = busy || !pages.some(page => page.text.trim() || page.translation?.trim());
  fileInput.disabled = busy;
  pageSelect.disabled = busy;
  language.disabled = busy;
  recognize.disabled = busy || !pages.some(({ complete }) => !complete);
  moveUp.disabled = busy || selectedIndex <= 0;
  moveDown.disabled = busy || !hasPage || selectedIndex >= pages.length - 1;
  remove.disabled = busy || !hasPage;
  result.readOnly = busy || !hasPage;
  copy.disabled = save.disabled = busy || !pages.some(page => page.text.trim() || page.translation?.trim());
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
  translation.value = page?.translation ?? '';
  updatePreview();
  updateImagePreview();
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
  pages.push(...supported.map((file) => ({ file, text: '', translation: '', complete: false })));
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

async function runRecognition(pending) {
  if (busy) return;
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
        const { data } = await worker.recognize(await prepareImage(page.file, processing));
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
}
recognize.addEventListener('click', () => runRecognition(pages.filter(({ complete }) => !complete)));
recognizeAgain.addEventListener('click', () => {
  if (busy) return;
  if (pages.some(page => page.text.trim()) && !confirm('Nhận dạng lại sẽ thay văn bản gốc đã chỉnh sửa ở các trang thành công. Bạn cần soát lại bản dịch sau đó. Tiếp tục?')) return;
  runRecognition([...pages]);
});

result.addEventListener('input', () => {
  const page = pages[selectedIndex];
  if (page) page.text = result.value;
  storageStatus.textContent = 'Đang chờ lưu…';
  updatePreview();
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
translation.addEventListener('input', () => {
  if (pages[selectedIndex]) pages[selectedIndex].translation = translation.value;
  clearTimeout(saveTimer);
  storageStatus.textContent = 'Đang chờ lưu…';
  saveTimer = setTimeout(persistProject, 300);
  updatePreview();
  updateControls();
});
translationPrompt.addEventListener('click', async () => {
  const text = pages[selectedIndex]?.text;
  if (!text) return;
  const prompt = 'Hãy dịch đoạn sách dưới đây sang tiếng Việt tự nhiên, giữ đúng ý và cách chia đoạn. Chỉ trả về bản dịch. Đoạn có thể bắt đầu hoặc kết thúc giữa câu do chia trang; không tự bổ sung nội dung còn thiếu.\n\n' + text;
  try {
    await navigator.clipboard.writeText(prompt);
    outputStatus.textContent = 'Đã sao chép. Dán vào ChatGPT, rồi đưa bản dịch về ô Bản dịch tiếng Việt.';
  } catch {
    outputStatus.textContent = 'Không thể sao chép. Hãy sao chép nguyên văn trong ô phía trên để dịch.';
  }
});
epub.addEventListener('click', () => {
  try {
    download(makeEpub(projectSnapshot()), (bookTitle.value.trim() || 'sach-song-ngu') + '.epub', 'application/epub+zip');
    outputStatus.textContent = 'Đã xuất EPUB. Các trang chưa có bản dịch giữ phần nguyên văn.';
  } catch (error) {
    console.error(error);
    outputStatus.textContent = 'Không thể xuất EPUB. Hãy kiểm tra nội dung và thử lại.';
  }
});
save.addEventListener('click', () => {
  download(combinedText(), (bookTitle.value.trim() || 'van-ban') + '.txt', 'text/plain;charset=utf-8');
});
bookTitle.addEventListener('input', persistProject);
language.addEventListener('change', persistProject);
layout.addEventListener('change', () => { updatePreview(); persistProject(); });
prc.addEventListener('click', () => {
  try {
    download(makePrc(projectSnapshot()), (bookTitle.value.trim() || 'sach-song-ngu') + '.prc', 'application/x-mobipocket-ebook');
    outputStatus.textContent = 'Đã xuất PRC dạng Mobipocket với văn bản tiếng Việt.';
  } catch (error) {
    outputStatus.textContent = error.message;
  }
});
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
  layout.value = project.layout ?? 'page';
  processing = validateProcessing(project.processing);
  setProcessingControls();
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
