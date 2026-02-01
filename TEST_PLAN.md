# WordMaster - Test Plan

This document provides a comprehensive test plan for WordMaster features. Use this as a checklist when developing new features or verifying releases.

## Core Functionality Tests

### 1. Quiz Setup & Start
- [ ] **Library Selection**
  - Select a library item from dropdown
  - Verify "Start Quiz" button becomes enabled
  - Press `Enter` to start (keyboard shortcut)
  - Verify quiz starts with correct word list
  
- [ ] **Paste Custom List (Spelling Only)**
  - Paste words (one per line): `apple\nbanana\norange`
  - Select "Spelling Only" mode
  - Start quiz
  - Verify words appear in random order
  
- [ ] **Paste Custom List (Spelling & Meaning)**
  - Paste: `apple: a red fruit\nbanana: a yellow fruit`
  - Select "Spelling & Meaning" mode
  - Start quiz
  - Verify both spelling and meaning inputs are visible

- [ ] **Mode Switching**
  - Change from "Spelling Only" to "Spelling & Meaning"
  - Verify placeholder text updates in paste area
  - Verify label text changes appropriately

### 2. Quiz Flow

#### Spelling Only Mode
- [ ] Type correct spelling → Press `Enter` → Verify:
  - Feedback shows "Correct!" with meaning
  - Word root is displayed (if available) in separate block with border
  - "Check" button becomes "Next Word"
  - Correct counter increments
  - Progress bar advances
  
- [ ] Type incorrect spelling → Press `Enter` → Verify:
  - Feedback shows "Incorrect" with correct word and meaning
  - Word root is displayed
  - Incorrect counter increments
  - Input becomes disabled

- [ ] Press `Enter` on "Next Word" button → Verify:
  - Moves to next word
  - Inputs are cleared and re-enabled
  - Audio pronounces the word automatically

#### Spelling & Meaning Mode
- [ ] Verify both spelling and meaning input fields are visible
- [ ] Test correct answer for both fields
- [ ] Test incorrect spelling with correct meaning
- [ ] Test correct spelling with incorrect meaning

### 3. Audio & Pronunciation
- [ ] Click speaker button → Verify word is pronounced
- [ ] Verify visual feedback (button pulses during speech)
- [ ] Press `Ctrl + Space` (Windows/Linux) or `Cmd + Space` (Mac)
  - Verify audio replays
  - Works during quiz state
  - Works after feedback is shown

### 4. Progress Tracking & Persistence

#### LocalStorage Persistence
- [ ] Complete a quiz with 2 correct, 1 incorrect
- [ ] Refresh the browser page
- [ ] Verify "Total Mastered" counter on setup screen is preserved
- [ ] Verify theme preference is preserved (Light/Dark)

#### Mastery Counter
- [ ] Answer word correctly → Check localStorage
  - Word added to `wordmaster-mastered`
  - Word removed from `wordmaster-incorrect` (if it was there)
  
- [ ] Answer word incorrectly → Check localStorage
  - Word added to `wordmaster-incorrect`
  - Counter on setup screen updates

### 5. Review Incorrect Mode (Book-Scoped)
- [ ] **Button Visibility**
  - With no library selected (paste mode) → Verify button is HIDDEN
  - Select a library book with 0 incorrect words → Verify button is HIDDEN
  - Select a library book with incorrect words → Verify button is VISIBLE
  - Verify button text shows count (e.g., "Review Incorrect (3)")
  
- [ ] **Empty State**
  - Select a book with no incorrect words
  - Verify "Review Incorrect" button does not appear
  
- [ ] **Active Review - Single Book**
  - Do "Wordly Wise - Lesson 1" → Answer 2 words incorrectly
  - Click Restart
  - Verify button shows "Review Incorrect (2)"
  - Click the button
  - Verify:
    - Quiz starts immediately (no crash)
    - Only the 2 incorrect words from Lesson 1 appear
    - Words are in shuffled order
    
- [ ] **Cross-Book Isolation**
  - Do "Wordly Wise - Lesson 1" → Get 2 words wrong
  - Do "Classical Roots E - Lesson 1" → Get 1 word wrong  
  - Return to setup
  - Select "Wordly Wise - Lesson 1" → Verify button shows "(2)"
  - Select "Classical Roots E - Lesson 1" → Verify button shows "(1)"
  - Click "Review Incorrect" on Wordly Wise → Verify only Wordly Wise words appear

#### Test 5.5: Review Incorrect Button Persists After Restart
**Purpose**: Verify button remains visible after restarting quiz

**Steps**:
1. Select a library book with incorrect words (e.g., from Test 5.1)
2. Verify "Review Incorrect (N)" button is visible
3. Click "Start Quiz"
4. Click "Restart" button (top right)
5. **Expected**: "Review Incorrect (N)" button still visible with same count
6. **Expected**: Button text matches number of incorrect words for selected book

#### Test 5.6: Correctly Answered Words Removed from Incorrect List
**Purpose**: Verify that answering an incorrect word correctly removes it from review list

**Steps**:
1. Select book with incorrect words, note count (e.g., "Review Incorrect (4)")
2. Click "Review Incorrect"
3. Answer first word CORRECTLY
4. Click "Next Word"
5. Click "Restart"
6. **Expected**: Button count decreased by 1 (e.g., "Review Incorrect (3)")
7. **Expected**: Correctly answered word not included in next review session

- [ ] **Progress Update**
  - Select book with 3 incorrect words → Button shows "(3)"
  - Review and correctly answer 1 word
  - Return to setup, re-select same book
  - Verify button now shows "(2)"


### 6. UI Controls & Navigation

#### Restart Button
- [ ] During quiz, click restart button (circular arrow)
- [ ] Verify:
  - Returns to setup screen
  - Library selection is preserved (does not reset to first item)
  - Paste area is cleared
  - Score counters reset

#### Results Screen
- [ ] Complete a quiz
- [ ] Verify results display:
  - Percentage score
  - Total words count
  - Correct count (green)
  - Incorrect count (red)
  
- [ ] Click "Restart" on results screen
- [ ] Press `Enter` on results screen → Verify restart

### 7. Theme Switching
- [ ] Click theme toggle (sun/moon icon)
- [ ] Verify:
  - Theme switches between light and dark
  - Icon changes appropriately
  - Colors update (background, text, cards)
  
- [ ] Refresh page
- [ ] Verify theme persists

### 8. Mobile Responsiveness

#### Layout Tests (DevTools Mobile or Real Device)
- [ ] Open on viewport width < 768px
- [ ] Verify:
  - No horizontal scrolling
  - Cards are full-width with proper padding
  - Buttons are touch-friendly (min 44px tap target)
  - Text is readable without zooming
  
#### Input Focus Prevention
- [ ] Tap on spelling input field
- [ ] Verify page does NOT zoom in (font-size >= 16px)
- [ ] Tap on meaning input
- [ ] Verify no zoom

#### Section 6: Quiz Flow & Interaction

### Test 6.1: Feedback Timing - No Premature Feedback
**Purpose**: Verify feedback only appears after user submits answer, not on quiz start

**Steps**:
1. Select any library book
2. Click "Start Quiz"
3. Wait 2 seconds WITHOUT typing anything
4. **Expected**: Feedback element is hidden (no "Correct" or "Incorrect" message visible)
5. **Expected**: Input fields are empty and enabled
6. Type a word and press Enter
7. **Expected**: NOW feedback appears (either "Correct" or "Incorrect")

**Regression Test - Feedback Clears on Restart**:
1. After seeing feedback (correct or incorrect)
2. Click "Restart" button
3. Start quiz again
4. **Expected**: Old feedback message is NOT visible on new quiz start
5. **Expected**: Feedback only appears again after submitting first answer
#### Touch Interactions
- [ ] Tap speaker button → Audio plays
- [ ] Tap "Check" button → Works immediately
- [ ] Tap "Next Word" → Advances correctly

### 9. Keyboard Shortcuts (Desktop)
| Action | Shortcut | Context |
|:---|:---|:---|
| Start Quiz | `Enter` | Setup screen (when Start enabled) |
| Submit Answer | `Enter` | Quiz state (input focused) |
| Next Word | `Enter` | After feedback shown |
| Replay Audio | `Ctrl/Cmd + Space` | During quiz |
| Restart | `Enter` | Results screen |

- [ ] Test all shortcuts in their respective contexts
- [ ] Verify shortcuts do NOT fire in wrong context

### 10. Word Root Display
- [ ] Select a lesson from "Classical Roots" (has root data)
- [ ] Answer a word correctly
- [ ] Verify feedback shows:
  - Definition text
  - Horizontal separator line
  - **Root:** label in bold
  - Root information in standard text color (not muted)
  
- [ ] Answer incorrectly → Verify root still displays
- [ ] Select a lesson without roots (custom paste) → Verify no error

### 11. Edge Cases & Error Handling

#### Empty Inputs
- [ ] Click "Start Quiz" with no library selected and empty paste
- [ ] Verify alert: "Please select or enter some words first!"

#### Mid-Quiz Behavior
- [ ] During quiz, verify cannot access setup screen directly
- [ ] Verify progress bar fills correctly (0% → 100%)
- [ ] On last word, verify "Next Word" transitions to Results

#### Library vs Paste
- [ ] Select library item → Verify paste area hides
- [ ] Deselect library → Verify paste area shows
- [ ] Type in paste area → Verify library dropdown hides
- [ ] Clear paste area → Verify library dropdown shows

## Performance & Compatibility

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Screen Sizes
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667, 414x896)

## Regression Checklist (Before Each Release)
Use this abbreviated list to quickly verify no regressions:

1. [ ] Start quiz from library → Works
2. [ ] Start quiz from paste → Works
3. [ ] Spelling-only mode hides meaning input
4. [ ] Keyboard shortcuts all functional
5. [ ] Audio pronunciation works
6. [ ] Progress persists after refresh
7. [ ] Review Incorrect shows/hides correctly and filters by book
8. [ ] Review Incorrect button persists after restart with correct count
9. [ ] Correctly answered incorrect words removed from review list
10. [ ] Restart preserves library selection
11. [ ] Word root displays clearly
12. [ ] Feedback appears only AFTER user submits answer (not on quiz start)
13. [ ] Mobile: No zoom on input focus
