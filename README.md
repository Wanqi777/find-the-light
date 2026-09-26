# Find the Light

A quiet, dependency-free room interaction study for **Activity: Describe It. Prompt It. Reflect On It.**

## Original idea and intended experience

Find the Light is a small browser experience for classmates and people who enjoy playful, low-pressure exploration. Users discover lamps inside a dim illustrated room and change its atmosphere through clicking, holding, and pulling rather than a separate control panel.

**When someone holds the ceiling pendant for about 1.2 seconds, the experience should show a growing charge ring and light preview, then toggle the light exactly once; releasing early or leaving the interaction should cancel the charge.**

The ceiling lamp is the main interaction evaluated for this activity. The simpler desk lamp and physical pull cord provide contrasting ways to explore the same idea: how an object's appearance and feedback can suggest an action. The intent is curiosity, not speed or a score.

This description summarizes the supplied design brief. The testing record and reflection below were added later; they are not presented as notes written before implementation.

## Project placement

The workspace did not contain the prompt's described pre-existing three-light room. To avoid overwriting the unrelated Dark Pattern Clinic, To-do List, and Volume Ward projects, this standalone implementation lives in `Labs/find-the-light/`.

## Run

Download or clone the repository, open this project's folder, and open `index.html` in a modern browser. No install, account, network request, audio, or external asset is required. All HTML, CSS, and JavaScript are inside that file.

For an optional local server, run this from the folder containing `index.html`:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Interactions

- **Desk lamp — Click / discovery:** click or tap the lamp to toggle a compact warm reading pool. It gives a brief flicker before settling.
- **Ceiling pendant — Hold / charge:** press and hold the pendant for about 1.2 seconds. The ring and cool wash accumulate as it charges; release too early and the preview fades. A full hold toggles it on or off.
- **Floor lamp — Drag / pull:** drag its physical pull cord down and release after the knot warms. The cord springs back and toggles the soft orange ambient light.

Keyboard equivalents are intentionally available without adding visible control panels: desk lamp uses Enter/Space; ceiling lamp is held with Enter/Space; floor-lamp cord uses Enter/Space. Pointer events cover mouse, touch, and pen input.

## Lighting combinations

| State | Desk | Ceiling | Floor | Environment |
| --- | --- | --- | --- | --- |
| 000 | off | off | off | Darkness |
| 100 | on | off | off | Reading |
| 010 | off | on | off | Focus |
| 001 | off | off | on | Cozy |
| 110 | on | on | off | Working |
| 101 | on | off | on | Sunset |
| 011 | off | on | on | Ambient |
| 111 | on | on | on | Awake |

The mode name appears only the first time a non-dark combination is discovered. After all three lights remain on for about 1.8 seconds, the room quietly asks “Too bright?” once per session (or until reset), inviting experimentation rather than treating maximum brightness as the goal.

## AI collaboration and selected prompts

**Tool used:** Codex. The following are excerpts from the actual design brief and conversation, not a complete conversation history.

1. **Define the experience:** “用户应该直接与房间中的物体互动。” (“Users should interact directly with objects in the room.”) This set the design direction: discoverable room objects instead of a conventional switch panel.
2. **Specify behavior:** “松开过早则灯光逐渐熄灭。” (“If released too early, the light gradually fades.”) This made the hold threshold and cancellation behavior important, not just the finished appearance.
3. **Request implementation:** “直接根据这个prompt生成项目” (“Generate the project directly from this prompt.”) Codex generated a self-contained HTML/CSS/JavaScript version. The expected existing three-lamp project was not found, so it used a separate folder to preserve the unrelated projects.
4. **Ask to understand the output:** “can you show me the changed code in the original html, just highlight the related code” and “show me the difference just in code level (html, css, js)”. The source retains numbered `ADDED` comments linking the interface, styling, and behavior to the implementation.

The human-directed choices were the exploratory room, distinct click/hold/pull gestures, and different lighting moods. Codex supplied the code, chose CSS-based lighting layers for this implementation, and later added simulated regression checks. Whether the subtle hints actually make the gestures understandable still requires human play-testing; generated code and passing checks do not establish that on their own.

## Implementation notes

- `index.html` contains semantic structure, CSS room illustration, visual lighting layers, and all interaction logic in one file.
- `lightState` is centrally managed and `updateRoomLighting()` maps its binary combination to light casts, furniture atmosphere, the mode whisper, cursor exploration state, and accessibility labels.
- The initial radial-gradient exploration light follows the pointer only while every room light is off.
- A low-cost optional Easter egg recognizes the quick sequence desk → floor → ceiling and briefly reveals **Midnight Mode**.
- The prompt listed sound as a secondary enhancement; it was intentionally omitted so browser autoplay policies and audio are not needed for the core visual lesson.

## Testing and revision record

**2026-09-25 — automated checks run by Codex, not a student browser test.** The test file loads the actual inline JavaScript in Node's isolated execution context with a simulated document, events, and clock. It checks observable mode attributes, light classes, accessibility states, and messages. It does not test rendering or prove that real browser events behave identically.

Before the fixes: **13 tests, 7 passed, 6 failed.** After revising the interaction logic and running the same tests again: **13 passed, 0 failed.**

| Test situation | Observed before revision | Change and retest result |
| --- | --- | --- |
| Hold the ceiling lamp for 400 ms, then move element focus, blur the window, or hide the document (3 tests) | Charging continued and switched the lamp on despite the interruption. | Cancel charging on all three interruption events; all three cases now remain off and allow a new hold. |
| Send a repeated Space keydown while charging (1 test) | The repeated event was not prevented, leaving the browser's default behavior available. | Prevent the default for every activation-key event but only start on the first keydown; the event assertion now passes. |
| Pull beyond the threshold, then unexpectedly lose pointer capture (1 test) | The floor lamp switched on as if the user had released intentionally. | Treat capture loss as cancellation; it now returns the cord without changing the light. |
| Turn all lamps on, then turn one off before the delayed question (1 test) | “Too bright?” still appeared while a lamp was off. | Cancel the timer when leaving all-on, recheck state before displaying, and mark the question seen only when shown; cancellation and later rediscovery now pass. |

The other seven passing tests cover initial darkness and desk toggles; short and completed holds; short, full, and cancelled pulls; all eight light combinations; reset during gestures; reset during a pending question; and showing the all-on question only once. The code also dismisses a visible question when the room is no longer all-on, and applies repeated-key prevention to the floor cord; those two additional details were inspected but are not separate assertions in this suite.

To rerun the optional checks, use Node.js 18 or later from this project's folder:

```sh
node tests/interactions.test.cjs
```

Node is only needed for these development checks, not to open or play the experience. Codex's attempted automated browser access was blocked by the browser security policy, so no browser play-test result is claimed here.

## Browser play-test checklist — student verification still needed

These are expected outcomes, **not completed test results**. Check them only after trying the page yourself, and record what actually happened.

- [ ] With all lights off, move the pointer. The dim exploration light follows; lighting any lamp hides it, and turning every lamp off restores it.
- [ ] Click the desk lamp twice. It turns on and then off, with a brief flicker.
- [ ] Release the ceiling pendant after a short hold. The preview fades and its on/off state does not change. Hold for at least 1.2 seconds: it toggles only once, even if you keep holding.
- [ ] Focus the ceiling lamp with Tab, hold Space, and move focus away before completion. Charging stops. Repeat while switching to another tab or window.
- [ ] Pull the floor cord a short distance and release: no toggle. Pull at least 78 pixels and release: one toggle and a spring-back. Check touch behavior separately on a real touch device.
- [ ] Explore the eight combinations. Leave the all-on state quickly: no stale “Too bright?” question should appear. Leave all three on for about 1.8 seconds: the question appears.
- [ ] Reset during a charge, a pull, or a pending message. All lamps remain off afterward.
- [ ] Try a narrow viewport, keyboard-only navigation, and operating-system reduced motion. Check readability, focus visibility, and whether any remaining motion feels uncomfortable.

**Your observation to add before submission:** device/browser; action tried; expected result; actual result; any change or unresolved issue. A screenshot or short recording is optional.

## Remaining limitations

- The automated checks do not render the page or exercise native browser focus, touch capture, screen readers, or CSS animation. Browser appearance and the feel of the gestures need personal verification.
- The charge ring and cord glow are deliberately subtle. Whether a new user understands them without instructions has not been established through user testing.
- CSS reduced-motion styling is present, but the JavaScript pointer-follow easing still runs. This is a remaining accessibility/performance improvement, not a claim of full reduced-motion support.
- Lighting and shadows are CSS illustrations, not physically simulated illumination. Furniture, plants, and the window are decorative rather than directly interactive. Sound is not implemented.

## Reflection — draft to review in your own voice

My intention was to make turning on a light feel like discovering something in a room, rather than operating a dashboard. The implementation represents that idea through three gestures and distinct lighting colors. I chose the ceiling lamp as the main interaction to evaluate because its feedback has to communicate both progress and the difference between a short press and a completed hold. One important implementation choice is to store each lamp's on/off state centrally and derive the room's appearance from those states. This separates a temporary charging preview from a committed change. The implemented behavior reflects my intention, but I still need to test whether the subtle hints make sense to a person who has not read the instructions.

AI helped translate the brief into HTML, CSS, and JavaScript, and it helped inspect behavior beyond the intended happy path. The review identified that a keyboard hold could continue after focus moved away and that a delayed “Too bright?” message could describe a lighting state the user had already left. Those cases show why asking for a finished effect is not enough: I also need to decide what interruption should mean and when feedback is still relevant. The automated checks described in this repository are AI-run logic checks, not my own browser play-test. Before submitting, I need to add my actual observations and revise this reflection accordingly. The main unresolved design question is whether discovery remains inviting rather than confusing, especially for keyboard and touch users.

## Individual submission checklist

- [ ] Complete the browser checks and replace the observation note with your own specific results.
- [ ] Review the reflection so it accurately represents your decisions and understanding.
- [ ] Save `index.html`, this `README.md`, and the optional `tests/` folder in **your own GitHub repository**. The current local checkout's remote is the course repository; these changes have not been pushed by Codex.
- [ ] Open your repository on GitHub and confirm the latest files and README are visible. Give the teaching team access if it is private.
- [ ] Submit your personal repository URL in Canvas. A deployed website, a separate Google Doc, and a full AI conversation transcript are not required.
