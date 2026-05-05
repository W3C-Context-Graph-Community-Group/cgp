class DocExporter {
  constructor(cardEl) {
    this.cardEl = cardEl;
  }

  get activeFile() {
    return window.location.hash.slice(1) || 'getting_started.md';
  }

  get baseName() {
    return this.activeFile.replace(/\.md$/i, '');
  }

  triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  stripMarkdown(md) {
    return md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^\|.*\|$/gm, function (line) {
        if (/^[\s|:-]+$/.test(line)) return '';
        return line.replace(/\|/g, '  ').trim();
      })
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.+?)\]\(.*?\)/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '- ')
      .replace(/^---+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  exportMD() {
    var self = this;
    fetch(this.activeFile)
      .then(function (r) { return r.text(); })
      .then(function (md) {
        self.triggerDownload(new Blob([md], { type: 'text/markdown' }), self.baseName + '.md');
      });
  }

  exportTXT() {
    var self = this;
    fetch(this.activeFile)
      .then(function (r) { return r.text(); })
      .then(function (md) {
        self.triggerDownload(new Blob([self.stripMarkdown(md)], { type: 'text/plain' }), self.baseName + '.txt');
      });
  }

  exportPDF() {
    html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: this.baseName + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(this.cardEl).save();
  }

  exportDOCX() {
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
      this.cardEl.innerHTML + '</body></html>';
    this.triggerDownload(htmlDocx.asBlob(html), this.baseName + '.docx');
  }

  export(format) {
    var fn = { md: 'exportMD', txt: 'exportTXT', pdf: 'exportPDF', docx: 'exportDOCX' }[format];
    if (fn) this[fn]();
  }
}
