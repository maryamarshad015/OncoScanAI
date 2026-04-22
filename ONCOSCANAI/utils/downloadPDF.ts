/**
 * Opens a print-ready window containing only the report element and
 * triggers the browser's native print dialog.
 * Users can choose "Save as PDF" from the printer dropdown — no npm
 * packages required, works in every browser.
 *
 * @param elementId  id of the report container div
 * @param fileName   suggested file name shown in the tab title
 */
export function downloadReportAsPDF(elementId: string, fileName: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`downloadReportAsPDF: element #${elementId} not found`);
    return;
  }

  // Collect all <link rel="stylesheet"> and <style> tags from the host page
  // so Tailwind classes render correctly in the print window.
  const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow pop-ups for this site so the PDF can be generated.');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${fileName}</title>
  ${styleSheets}
  <style>
    /* Reset margins for clean print output */
    @page { margin: 10mm; }
    body  { margin: 0; padding: 0; background: #fff; font-family: sans-serif; }
    /* Hide browser header/footer in print */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${element.outerHTML}
  <script>
    // Wait for images to load before printing
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
        window.close();
      }, 400);
    };
  </script>
</body>
</html>`);

  printWindow.document.close();
}
