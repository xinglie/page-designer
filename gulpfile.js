let tmplFolder = 'tmpl'; //template folder
let srcFolder = 'src'; //source folder
let buildFolder = 'build';

let gulp = require('gulp');
let watch = require('gulp-watch');
let del = require('del');
let fs = require('fs');
let ts = require('typescript');
let concat = require('gulp-concat');
let combineTool = require('../magix-composer/index');

let removeESModuleReg = /"use strict";\s*Object\.defineProperty\(exports,\s*"__esModule",\s*\{\s*value:\s*true\s*\}\);?/g;

let exportsReg = /\bexports\.default\s*=/g;
let removeMiddleDefault = /(_\d+)\.default/g;
//清理编译后的代码，减少文件体积
let cleanCode = code => {
    return code.replace(removeESModuleReg, '').replace(exportsReg, 'module.exports=').replace(removeMiddleDefault, '$1');
};

combineTool.config({
    debug: true,
    commonFolder: tmplFolder,
    compiledFolder: srcFolder,
    projectName: 'd',
    loaderType: 'cmd_es',
    galleries: {
        mxRoot: 'gallery/',
        mxMap: {
            'mx-number': {
                _class: ' input pr'
            }
        }
    },
    scopedCss: [
        './tmpl/assets/_vars.less',
        './tmpl/assets/index.less'
    ],
    compileJSStart(content) {//对代码转换的钩子，这里使用typescript进行代码转换，也可以换成babel等转换器
        let str = ts.transpileModule(content, {
            compilerOptions: {
                lib: ['es7'],
                target: 'es2018',
                module: ts.ModuleKind.None
            }
        });
        str = str.outputText;
        str = cleanCode(str);
        return str;
    },
    progress({ completed, file, total }) {//编译进度条，这里在命令行输出当前编译到的文件和相关进度
        console.log(file, completed + '/' + total);
    },
});

gulp.task('cleanSrc', () => del(srcFolder));

gulp.task('combine', gulp.series('cleanSrc', () => {
    return combineTool.combine().then(() => {
        console.log('complete');
    }).catch(function (ex) {
        console.log('gulpfile:', ex);
        process.exit();
    });
}));

gulp.task('watch', gulp.series('combine', () => {
    watch(tmplFolder + '/**/*', e => {
        if (fs.existsSync(e.path)) {
            var c = combineTool.processFile(e.path);
            c.catch(function (ex) {
                console.log('ex', ex);
            });
        } else {
            combineTool.removeFile(e.path);
        }
    });
}));

var terser = require('gulp-terser-scoped');
gulp.task('cleanBuild', () => {
    return del(buildFolder);
});

gulp.task('build', gulp.series('cleanBuild', 'cleanSrc', () => {
    combineTool.config({
        debug: false
    });
    combineTool.combine().then(() => {
        gulp.src(srcFolder + '/**/*.js')
            .pipe(terser({
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                    keep_fargs: false,
                    global_defs: {
                        DEBUG: false
                    }
                }
            }))
            .pipe(gulp.dest(buildFolder));
    }).catch(ex => {
        console.error(ex);
    });
}));

let terserOptions = {
    compress: {
        drop_console: true,
        drop_debugger: true,
        keep_fargs: false,
        global_defs: {
            DEBUG: false
        }
    },
    output: {
        ascii_only: true,
        comments: /^!/
    }
};
gulp.task('dist', gulp.series('cleanSrc', () => {
    return del('./dist').then(() => {
        combineTool.config({
            debug: false
        });
        return combineTool.combine();
    }).then(() => {
        return gulp.src([
            './src/index.js',
            './src/gallery/**',
            './src/i18n/**',
            './src/panels/**',
            './src/elements/**',
            './src/designer/**'])
            .pipe(concat('index.js'))
            .pipe(terser(terserOptions))
            .pipe(gulp.dest('./dist'));
    });
}));