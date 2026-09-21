const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const output = fs.createWriteStream(path.join(process.cwd(), 'public/export.zip'));
const archive = archiver.create('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('Archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

archive.directory('public/images/', 'images');
archive.directory('public/images_thumb/', 'images_thumb');
archive.directory('public/images_ai/', 'images_ai');
if (fs.existsSync('public/garments_data.json')) {
  archive.file('public/garments_data.json', { name: 'garments_data.json' });
}

archive.finalize();
