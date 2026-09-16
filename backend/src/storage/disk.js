const fs = require('node:fs/promises');
const path = require('node:path');

// Keeps uploads as plain files under uploadsDir; Express serves that directory at publicUrl.
function createDiskStorage({ uploadsDir, publicUrl }) {
  const fileFor = (key) => path.join(uploadsDir, key);

  return {
    async put(key, buffer) {
      await fs.mkdir(path.dirname(fileFor(key)), { recursive: true });
      await fs.writeFile(fileFor(key), buffer);
    },
    async remove(key) {
      await fs.rm(fileFor(key), { force: true });
    },
    urlFor(key) {
      return `${publicUrl}/${key}`;
    },
  };
}

module.exports = { createDiskStorage };
