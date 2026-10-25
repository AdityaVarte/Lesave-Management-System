const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../tmp/visual_pdf_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const extractPdfText = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const hexMatches = content.match(/<([0-9a-fA-F]+)>/g) || [];
  const decodedHex = hexMatches.map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('');
  return { full: content, text: decodedHex };
};

console.log('================================================================');
console.log('              STEP 5: PDF VISUAL & STRUCTURAL CHECK             ');
console.log('================================================================\n');

for (const [key, item] of Object.entries(manifest)) {
  console.log(`Checking ${key} (${item.name}):`);
  console.log(`  File: ${item.filePath}`);
  console.log(`  Report Ref: ${item.reportRef}`);

  const { full, text } = extractPdfText(item.filePath);
  const pages = (full.match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`  Page Count: ${pages}`);

  // Check 1: Title & Reference format
  const refMatches = item.reportRef.match(/^LF-\d{8}-[A-F0-9]{4}$/);
  console.log(`  Report Ref Format: ${refMatches ? 'PASS' : 'FAIL'} (${item.reportRef})`);

  // Check 2: Header "LeaveFlow"
  const hasLeaveFlow = text.includes('LeaveFlow') || full.includes('LeaveFlow');
  console.log(`  Title "LeaveFlow": ${hasLeaveFlow ? 'PASS' : 'FAIL'}`);

  // Check 3: Footer Left text
  const hasFooterConfidential = text.includes('LeaveFlow - Confidential - For internal use only') || full.includes('LeaveFlow - Confidential');
  console.log(`  Footer Confidential: ${hasFooterConfidential ? 'PASS' : 'FAIL'}`);

  const pageFooterMatches = text.match(/Page \d+ of \d+/g) || [];
  console.log(`  Page Footers Found: ${JSON.stringify(pageFooterMatches)}`);
  const hasPageXofY = pageFooterMatches.length > 0;
  console.log(`  Footer Page X of Y: ${hasPageXofY ? 'PASS' : 'FAIL'}`);

  // Check 5: *** End of Report ***
  const hasEndOfReport = text.includes('*** End of Report ***') || full.includes('*** End of Report ***');
  console.log(`  End of Report Marker: ${hasEndOfReport ? 'PASS' : 'FAIL'}`);

  // Check 6: Truncation cap note (for cap_200)
  if (item.truncated) {
    const hasCapNote = text.includes(`Showing first 200 of ${item.totalCount} records`) || full.includes('first 200 of');
    console.log(`  200-Row Cap Note: ${hasCapNote ? 'PASS' : 'FAIL'}`);
  }

  // Check 7: Color check - ensure no colored stroke/fill commands like non-gray RGB
  // In PDF: `r g b rg` or `r g b RG` where r!=g or g!=b indicates color.
  // Gray is set with `g G` or equal rgb.
  const colorMatches = full.match(/(\d+(\.\d+)?)\s+(\d+(\.\d+)?)\s+(\d+(\.\d+)?)\s+(rg|RG)/g) || [];
  let nonMonochromeCount = 0;
  for (const cm of colorMatches) {
    const parts = cm.split(/\s+/);
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    if (Math.abs(r - g) > 0.01 || Math.abs(g - b) > 0.01) {
      nonMonochromeCount++;
    }
  }
  console.log(`  Color palette strictly monochrome: ${nonMonochromeCount === 0 ? 'PASS (100% monochrome)' : `FAIL (${nonMonochromeCount} colored commands)`}`);

  console.log('');
}

console.log('================================================================');
console.log('PDF Visual & Structural checks completed.');
console.log('================================================================\n');
