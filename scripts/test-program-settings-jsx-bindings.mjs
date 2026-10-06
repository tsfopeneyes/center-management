import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const files = [
    '../src/components/admin/board/components/forms/ProgramInfoSection.jsx',
    '../src/features/programs/settings/GuestIdentitySettings.jsx',
    '../src/features/programs/settings/ApplicationQuestionSettings.jsx',
    '../src/features/programs/settings/ProgramScheduleSettings.jsx',
    '../src/features/programs/settings/LocationRecruitmentSettings.jsx',
    '../src/features/programs/settings/HostSettings.jsx',
    '../src/features/programs/settings/RewardFeedbackSettings.jsx',
    '../src/features/programs/settings/ChallengeSettings.jsx',
    '../src/features/programs/settings/ApplicantExperienceSettings.jsx',
    '../src/features/programs/settings/ProgramAudienceSettings.jsx',
    '../src/features/programs/settings/ProgramVisibilitySettings.jsx',
    '../src/features/programs/settings/ProgramParticipationSettings.jsx',
    '../src/features/programs/settings/ProgramSettingsLayout.jsx',
];
const missing = [];
const knownGlobals = new Set([
    ...Object.getOwnPropertyNames(globalThis),
    'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
    'File', 'FileReader', 'Image', 'HTMLElement', 'Event',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'requestAnimationFrame', 'cancelAnimationFrame', 'alert', 'confirm',
]);

for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, {
        ReferencedIdentifier(path) {
            const name = path.node.name;
            if (!path.scope.hasBinding(name) && !knownGlobals.has(name)) {
                missing.push(`${file}:${path.node.loc.start.line} ${name}`);
            }
        },
        JSXOpeningElement(path) {
            const name = path.node.name;
            if (name.type !== 'JSXIdentifier' || !/^[A-Z]/.test(name.name)) return;
            if (!path.scope.hasBinding(name.name)) {
                missing.push(`${file}:${name.loc.start.line} ${name.name}`);
            }
        },
    });
}

assert.deepEqual(missing, [], `Unbound program settings references: ${missing.join(', ')}`);
console.log('PASS: program settings JavaScript and JSX references are bound.');
