---
description: React Clean Architecture Rules
---
# React Clean Architecture Rules

## Component Size Limits
- Maximum 150 lines per component file
- If exceeding, automatically suggest component split
- Extract complex logic into custom hooks

## Separation of Concerns  
- UI components: Only rendering and event handling
- Business logic: Move to custom hooks (hooks/)
- Utilities: Pure functions in utils/
- Types: Separate files in types/

## File Organization
- Group related components in folders
- Create index.js for clean imports
- Follow naming conventions: PascalCase for components

## Auto-refactoring Triggers
- 7+ useState hooks → Extract to custom hook
- 3+ major responsibilities → Split component  
- 5+ levels of nesting → Simplify structure
