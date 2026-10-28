# Welcome density refinement

User request: slightly reduce poster density, verify Korean spelling, remove warped text from the final screen, and fill the viewport on all phone aspect ratios.

Preserved the raster display scenes on pages 1–5, with a smaller visual share of each screen. All descriptive/factual copy is now the original JSX text rather than generated lettering. Page 6 uses the original group character and straight live text throughout. Sections fill the viewport width and height; desktop uses an art/copy split instead of a narrow portrait with outside bars. Navigation and chat use actual controls.

The activities graphic was edited with built-in imagegen to remove the lower icon/text list; the list is now exact semantic text in the page. Original illustration and the exact question remain. Source: welcome-poster-4.png. Output: public/brand/center/welcome-activities-art-v2.png. Prompt: retain HAIFN wordmark, original Cloudy skateboard character and the exact Korean title 오늘은 / 뭐 하고 / 놀까?, remove all lower activity labels/icons/descriptions, leave cream lower space, preserve red/cream/brown. Title and spelling visually reviewed.

Mechanical detector ran once on the changed JSX/CSS. It reports advisory palette/type-ramp documentation drift including the existing rules; it is not an accessibility pass. No backend or deployment change is included in this refinement.
