export function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bilingual-book-maker', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readProject() {
  const db = await openStorage();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('projects');
      const request = transaction.objectStore('projects').get('current');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function writeProject(project) {
  const db = await openStorage();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(project, 'current');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function exportProject(project) {
  const pages = [];
  for (const page of project.pages) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(page.file);
    });
    pages.push({ name: page.file.name, type: page.file.type, data,
      text: page.text, complete: page.complete });
  }
  return JSON.stringify({ version: 1, title: project.title, language: project.language, pages });
}

export function importProject(text) {
  const value = JSON.parse(text);
  const types = ['image/png', 'image/jpeg', 'image/webp'];
  if (value.version !== 1 || typeof value.title !== 'string' ||
      !['eng', 'vie', 'vie+eng'].includes(value.language) || !Array.isArray(value.pages)) {
    throw new Error('Dự án không đúng định dạng.');
  }
  const pages = value.pages.map((page) => {
    if (!types.includes(page.type) || typeof page.name !== 'string' ||
        typeof page.text !== 'string' || typeof page.complete !== 'boolean' ||
        typeof page.data !== 'string' || !page.data.startsWith('data:' + page.type + ';base64,')) {
      throw new Error('Trang trong dự án không hợp lệ.');
    }
    const bytes = Uint8Array.from(atob(page.data.split(',')[1]), char => char.charCodeAt(0));
    if (!bytes.length) throw new Error('Ảnh trống.');
    return { file: new File([bytes], page.name, { type: page.type }),
      text: page.text, complete: page.complete };
  });
  return { title: value.title, language: value.language, pages };
}
