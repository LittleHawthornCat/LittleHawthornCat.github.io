// js/show_markdown.js

// 暴露给全局的渲染函数
function renderMarkdownToHTML(src) {
  const codes = [];
  const boxes = [];
  const renders = [];

  // 1) 行扫描提取 ```render 围栏
  const lines = src.split('\n');
  const outLines = [];
  let i = 0;
  while (i < lines.length) {
    if (/^[ \t]*```render\b/.test(lines[i])) {
      i++;
      const body = [];
      while (i < lines.length) {
        if (/^[ \t]*```[ \t]*$/.test(lines[i])) {
          const next = lines[i + 1];
          if (next === undefined || /^[ \t]*$/.test(next)) break;
        }
        body.push(lines[i]);
        i++;
      }
      renders.push(body.join('\n'));
      outLines.push(`\n<div data-render-block="${renders.length - 1}"></div>\n`);
      i++;
    } else {
      outLines.push(lines[i]);
      i++;
    }
  }
  let text = outLines.join('\n');

  // 2) 提取 show / warn 块
  const lines2 = text.split('\n');
  const outLines2 = [];
  let j = 0;
  while (j < lines2.length) {
    const line = lines2[j];
    if (/^[ \t]*```(show|warn)\b/.test(line)) {
      const type = line.includes('warn') ? 'warn' : 'show';
      j++;
      const body = [];
      while (j < lines2.length) {
        if (/^[ \t]*```[ \t]*$/.test(lines2[j])) {
          const next = lines2[j + 1];
          if (next === undefined || /^[ \t]*$/.test(next)) break;
        }
        body.push(lines2[j]);
        j++;
      }
      boxes.push({ type, body: body.join('\n') });
      outLines2.push(`\u0002${boxes.length - 1}\u0002`);
      j++;
    } else {
      outLines2.push(line);
      j++;
    }
  }
  text = outLines2.join('\n');

  // 3) 保护普通代码块 / 行内代码
  text = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, m => {
    codes.push(m);
    return `\u0000${codes.length - 1}\u0000`;
  });

  // 4) ===文字=== 居中大标题
  text = text.replace(/^[ \t]*===(.+?)===[ \t]*$/gm, (_, title) => 
    `\n<div class="center-title">${title.trim()}</div>\n`
  );

  // 5) 数学公式替换
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, body) => 
    '\n' + katex.renderToString(body.trim(), { displayMode: true, throwOnError: false }) + '\n'
  );
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => 
    '\n' + katex.renderToString(body.trim(), { displayMode: true, throwOnError: false }) + '\n'
  );
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => 
    katex.renderToString(body.trim(), { displayMode: false, throwOnError: false })
  );
  text = text.replace(/(?<![\d\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (match, body) => {
    try {
      return katex.renderToString(body.trim(), { displayMode: false, throwOnError: false });
    } catch { return match; }
  });

  // 6) 还原普通代码
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);

  // 7) 还原 show / warn 块
  text = text.replace(/\u0002(\d+)\u0002/g, (_, i) => {
    const item = boxes[+i];
    const innerHtml = renderMarkdownToHTML(item.body); // 递归调用
    const cls = item.type === 'warn' ? 'warn-box' : 'show-box';
    return `\n<div class="${cls}">${innerHtml}</div>\n`;
  });

  // 8) 还原 render 块（转成 iframe）
  text = text.replace(/<div data-render-block="(\d+)"><\/div>/g, (_, i) => {
    return `<div class="html-frame"><iframe srcdoc="${renders[+i].replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="width:100%; border:none; overflow:hidden;"></iframe></div>`;
  });

  // 最后交给 marked 解析
  return marked.parse(text);
}