import {build} from 'vite';
import config from '../vite.config.js';
const settings=config({mode:'production',command:'serve'});
await build({...settings,configFile:false,build:{...settings.build,outDir:'welcome-preview-dist',minify:false}});
