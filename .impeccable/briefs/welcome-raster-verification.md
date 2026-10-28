# Welcome raster poster implementation

The user approved using images to preserve the selected poster composition instead of approximating its Korean lettering with web fonts. Page 1 uses the exact supplied artwork. Pages 2–6 use built-in imagegen with that approved artwork and the assigned character as references. Prompt copy and asset mapping are recorded in welcome-raster-prompts.json.

Each poster preserves its portrait aspect ratio and fits within the viewport without cropping. Equivalent Korean content remains as semantic HTML for screen readers. Navigation and the final chat action are real buttons over the artwork. No database, push, DM, or deployment changes are included.

Verified locally at http://127.0.0.1:5181/welcome with a 390 × 844 viewport: all five new posters load, navigation advances across pages, and the final yellow chat button opens the existing consultation sheet. Captures are in welcome-screenshots/02-raster.png through 06-raster.png. The local preview build passed. Sending a visitor message was not tested in this visual change.
