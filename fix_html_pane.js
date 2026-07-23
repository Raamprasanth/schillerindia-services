const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend', 'public', 'Reports.html');
let content = fs.readFileSync(file, 'utf8');

// Find and remove the Commercial pane from its wrong position
const startTag = '<!-- COMMERCIAL SUB-TAB -->';
let startIndex = content.indexOf(startTag);
if (startIndex !== -1) {
  // Try to find the closing div of the pane.
  // The pane has 4 closing divs: </div></div></div></div>
  // Or we can just use a more targeted string match to the end of the pane HTML.
  const endMarker = '          </div>\n        </div>\n      </div>';
  let endIndex = content.indexOf(endMarker, startIndex);
  if (endIndex !== -1) {
    endIndex += endMarker.length;
    const paneHTML = content.substring(startIndex, endIndex);
    
    // Remove it
    content = content.slice(0, startIndex) + content.slice(endIndex);
    
    // Find the right place to put it:
    // Right before </div><!-- /tab-performance -->
    const targetSpot = '</div><!-- /tab-performance -->';
    const targetIdx = content.indexOf(targetSpot);
    if (targetIdx !== -1) {
      content = content.slice(0, targetIdx) + '\n' + paneHTML + '\n      ' + content.slice(targetIdx);
      fs.writeFileSync(file, content, 'utf8');
      console.log('Successfully moved Commercial Pane to the correct spot.');
    } else {
      console.log('Error: Could not find target spot "</div><!-- /tab-performance -->".');
    }
  } else {
    console.log('Error: Could not find end of Commercial Pane.');
  }
} else {
  console.log('Error: Could not find start of Commercial Pane.');
}
