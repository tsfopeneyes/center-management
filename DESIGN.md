---
name: HAIFN welcome
description: Six graphic posters for the HAIFN introduction route
colors:
  primary: "#cf3a27"
  paper: "#f7efe2"
  ink: "#332821"
  invitation-action: "#f8df53"
  surface: "#fffdf9"
  line: "#e7d8c4"
  muted: "#71665c"
typography:
  display:
    fontFamily: "Pretendard, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(54px, 16vw, 78px)"
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Pretendard, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
    letterSpacing: "-0.02em"
  main-copy:
    fontFamily: "Pretendard, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 750
    lineHeight: 1.5
rounded:
  square: "0"
  round: "50%"
  chat-window: "24px"
spacing:
  poster-gutter: "26px"
  copy-gap: "16px"
components:
  question-button:
    backgroundColor: "{colors.invitation-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "13px 18px"
    height: "48px"
  next-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.round}"
    size: "48px"
---

# Design System: HAIFN welcome

## Overview

**Creative North Star: "School club festival poster"**

Scope is `/welcome` only. This records the implemented route, following the first composition selected by the user. Other app surfaces retain their incumbent design system.

Bold Korean questions, authentic character cutouts, and diagonal color bands form one graphic composition. Approved information remains readable HTML beneath or beside the artwork. The existing chat retains its product styling and behavior.

**Key Characteristics:**
- Diagonal headline bands with integrated character scenes.
- HAIFN red and warm cream, with dark brown text.
- One app typeface and real supplied PNG characters.

## Colors

### Primary
- **HAIFN red:** Headline bands, wordmark, active navigation, and the final invitation ground.

### Secondary
- **Invitation yellow:** The chat action on the final red poster. Character artwork carries its own native yellow and teal.

### Neutral
- **Warm cream:** Poster background and reversed band text.
- **Dark brown:** Headlines and body copy on light surfaces.
- **Near-white surface, warm line, muted brown:** Existing chat surfaces, separators, and supporting text.

**The Reversal Rule.** The final invitation reverses red and cream while retaining the same typographic band grammar.

## Typography

**Display and Body Font:** Pretendard, with the existing UI sans-serif and system fallbacks.

Display type uses heavy weight (900), compact line height (1.02), and explicit Korean line breaks. The display token is the shared band base; each poster adjusts its size to its question length. The opening poster overrides it with (clamp(80px, 25vw, 120px)), paired with lead text at (clamp(86px, 27vw, 110px)). The opening lead overlaps the character row with a (-36px) bottom margin. The desktop shared band base is (84px); the opening poster sets its lead to (88px) and band to (100px). Body copy grows from (15px) to (18px) at the desktop breakpoint; main copy grows from (17px) to (23px).

Partner names use (13px) on mobile and (14px) on desktop.

**The One Typeface Rule.** Keep the existing app typeface for Korean display, body, and controls. Preserve semantic headings and text rather than embedding typography in images.

## Layout

Portrait posters use a centered container (540px maximum), with a grid stacking lead text, character scene, and diagonal band. Body copy follows. The poster has a minimum viewport height and can grow with its content. Short viewports reduce illustration height before reducing the main copy.

At the desktop breakpoint (768px), the container grows to (1200px), with artwork and copy in columns at a (1.25fr / .75fr) ratio and a (64px) gap. The desktop opening band has a right margin of (110px), and its character scene height is (min(22dvh, 180px)). Fixed wordmark and progress navigation frame the series. Sections use mandatory vertical snapping and stop at each section.

**The Scene Rule.** Keep character scale, question placement, and band direction coordinated within the stage. The band is composition geometry, not a separate card.

## Elevation & Depth

Poster surfaces are flat. Layer order places lead text and characters above the headline band without shadows. The existing desktop chat window uses one overlay shadow (`0 20px 70px rgba(25,20,17,.25)`) to separate the conversation from the page; it is not a poster motif.

## Shapes

Headline bands bleed beyond the content gutter and rotate by (8deg), (-7deg), or (7deg), according to the poster. The chat action is rectangular. Navigation buttons and progress markers are circular. Existing chat bubbles and fields retain rounded corners; mobile chat occupies the full viewport.

## Components

### Poster stage

A semantic heading supplies the opening phrase and band question; a real PNG cutout occupies the middle grid row. The original character group, Hati, Pongpong, Cloudy, and Didi/Dum images remain the source assets. No generated replacements or decorative star is added.

### Buttons and navigation

The final question action is yellow with dark text and an inline arrow. The next control is a red circle with a cream arrow; previous and restart controls are transparent. Disabled previous navigation has reduced opacity. Keyboard focus uses a visible outline (3px, offset 3px). Six progress targets have distinct accessible labels and an active dot.

### Existing visitor chat

Desktop chat is a rounded floating window; mobile is a full-height conversation. Its red header, cream message area, message bubbles, composer field, and send button retain the incumbent layout. Input focus changes its border to red. No contact fields are introduced by this redesign.

## Do's and Don'ts

### Do:
- Do retain the original character assets, app typeface, and red/cream palette.
- Do keep headings and all approved information as semantic text.
- Do coordinate typography and characters as one composition.
- Do allow content height to grow when a short viewport cannot contain it.

### Don't:
- Don't apply this route's poster composition to unrelated app surfaces.
- Don't add a decorative star to the HAIFN wordmark.
- Don't replace supplied characters with generated approximations.
- Don't change visitor chat behavior as part of poster styling.
