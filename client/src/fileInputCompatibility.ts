// Android/iOS document pickers can assign CSV exports different MIME types.
// Keep the server-side CSV validation authoritative, but do not let the browser
// hide a valid Trade Republic CSV just because its MIME type is unusual.
const CSV_ACCEPT = '.csv,text/csv,application/csv,text/plain,application/vnd.ms-excel,application/octet-stream,*/*';

function patchFileInputs(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
    if (input.accept !== CSV_ACCEPT) input.accept = CSV_ACCEPT;
  });
}

patchFileInputs();

const observer = new MutationObserver(() => patchFileInputs());
observer.observe(document.documentElement, { childList: true, subtree: true });
