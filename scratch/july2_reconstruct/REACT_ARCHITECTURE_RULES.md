# React Clean Architecture Rules

## 1. Component Size Limits
- **Maximum 300 lines** per component file.
- **Average under 200 lines** per component.
- If exceeding 300 lines, it is a strict trigger for component splitting and logic extraction.

## 2. Separation of Concerns
- **UI Components (JSX):** strictly for layout, rendering, and event bindings.
- **Business Logic (Hooks):** Move states (`useState`), effects (`useEffect`), and API calls into custom hooks (`hooks/`).
- **Utilities (`utils/`):** Pure functions that do not depend on React (e.g., formatters, validators).
- **Constants (`constants.js`):** Magic numbers, long configuration arrays, and fixed strings.

## 3. Directory & File Organization
- Group related components logically by feature.
- Create `index.js` or `index.ts` to export components cleanly.
- Naming Convention: `PascalCase` for Components, `camelCase` for hooks/utils.

## 4. Auto-refactoring Triggers
- **5+ `useState` hooks:** Extract state management into a custom hook.
- **3+ major responsibilities:** Split UI into smaller child components.
- **5+ levels of DOM nesting:** Simplify markup or extract to a sub-component.

## 5. Refactoring Workflow (Step-by-Step)
1. **Identify Target:** Find components approaching or exceeding 300 lines.
2. **Extract Logic:** Move states & handlers to `use[ComponentName].js`.
3. **Extract UI:** Break down the big JSX into smaller chunks (e.g. `Header`, `Form`, `List`, `Modal`).
4. **Assemble & Test:** Reassemble components, ensuring props are correctly passed without performance degradation.

## Troubleshooting: 1000+ line Component Split (Lessons Learned)
오늘 거대한 컴포넌트(AdminBoard 등)를 분리하면서 겪은 주요 오류와 해결(예방) 방법입니다. 다음 리팩토링 시 반드시 체크리스트로 활용합니다.

1. Props/State 누락 (`[Variable] is not defined`)
- 원인: JSX 코드를 자식 컴포넌트로 분리했으나, 부모에서 사용하던 상태나 함수를 자식에게 넘겨주지 않음.
- 예방/해결: 분리할 자식 컴포넌트가 필요로 하는 상태값과 업데이트 함수(`setState`)를 명확히 파악하고 Props로 전달합니다. 폼(Form) 요소의 경우 개별 상태 10개를 넘기지 말고, `formData` 객체 하나와 `updateField` 핸들러 하나로 묶어서 전달합니다.

2. 커스텀 훅 분리 오류 (상태 동기화 실패 및 Stale Closure)
- 원인: 수많은 `useState`와 로직을 `hooks/useNoticeForm.js` 등으로 옮긴 뒤, 필요한 업데이트 함수를 반환(return)하지 않거나, 의존성 배열(`deps`) 처리를 누락함.
- 예방/해결: 훅 안에서 정의된 모든 최신 상태와 핸들러를 `{ }` 객체나 `[ ]` 배열로 누락 없이 리턴합니다. `useEffect`나 `useCallback` 안에서 내부 상태를 참조할 때 반드시 의존성 배열에 추가하여 이전 상태를 참조하는 일(Stale Closure)을 방지합니다.

3. Import/Export 경로 미스 및 순환 참조 (Circular Dependency)
- 원인: 함수들을 `utils/`로, 상수들을 `constants.js`로 옮기는 과정에서 `export default`와 `export const`를 혼돈하거나, 유틸리티 함수 안에서 다시 UI 컴포넌트를 불러옴.
- 예방/해결: UI 컴포넌트는 무조건 `export default`를 사용하고, `utils`, `constants`, `hooks`는 `export const` (Named Export)를 사용합니다. `utils` 폴더 안의 함수는 React 종속성이 없는 순수 함수(Pure Function)로만 구성합니다.

4. 타이핑 시 인풋(Input) 포커스 잃음 (리렌더링 파괴)
- 원인: 부모 컴포넌트 함수 "내부"에 자식 컴포넌트 함수를 선언하여 부모가 렌더링될 때마다 자식이 완전히 새로 생성(Mount)됨.
- 예방/해결: **절대로 컴포넌트 내부에서 다른 컴포넌트를 선언하지 않습니다.** 무조건 개별 파일로 분리한 뒤 최상단에서 Import하여 사용합니다.