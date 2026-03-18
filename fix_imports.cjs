const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src', 'components', 'admin');

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'analytics' && file !== 'school') { // school and analytics might have already correct paths if they weren't moved, but let's check
                // The moved ones are inside board, dashboard, users, statistics, calendar, settings, messages
                // But wait, the previous ones were at src/components/admin/*.jsx
                // Now they are at src/components/admin/folder/*.jsx
                // They need one more `../` for local utils and components outside admin, or `../` instead of `./` for common admin components.
            }
            processSubDir(fullPath);
        }
    }
}

function processSubDir(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isFile() && fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Cases to fix:
            // 1. import ... from '../../supabaseClient' -> '../../../supabaseClient'
            // 2. import ... from '../../utils/...' -> '../../../utils/...'
            // 3. import ... from '../common/...' -> '../../common/...'
            // 4. import ... from './...' (if it used to point to another admin component that is now in another folder) -> This is trickier, depends on where it went.
            // Let's just fix the generic upward ones first.

            content = content.replace(/from\s+['"]\.\.\/\.\.\/supabaseClient['"]/g, "from '../../../supabaseClient'");
            content = content.replace(/from\s+['"]\.\.\/\.\.\/utils\//g, "from '../../../utils/");

            // Common components are at src/components/common, so from src/components/admin/folder it's ../../common
            content = content.replace(/from\s+['"]\.\.\/common\//g, "from '../../common/");

            if (content !== fs.readFileSync(fullPath, 'utf8')) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated paths in ${fullPath}`);
            }
        }
    }
}

processDirectory(adminDir);
console.log('Done mapping basic relative paths.');
