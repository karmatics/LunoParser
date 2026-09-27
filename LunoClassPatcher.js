class LunoClassPatcher {
  constructor() {}

  static parseAST(sourceText) {
    if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
      throw new Error('[Luno AST Guard] parseAST received empty source text.');
    }

    var acornObj = (typeof window !== 'undefined' && window.acorn) || (typeof globalThis !== 'undefined' && globalThis.acorn);
    if (!acornObj && typeof require !== 'undefined') {
      try { acornObj = require('acorn'); } catch (e) {}
    }

    if (!acornObj || typeof acornObj.parse !== 'function') {
      throw new Error('[Luno AST Guard] Acorn AST parser is not loaded in memory.');
    }

    var parseOpts = {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowHashBang: true,
      ranges: true,
      locations: true
    };

    try {
      return acornObj.parse(sourceText, parseOpts);
    } catch (e) {
      try {
        parseOpts.sourceType = 'script';
        return acornObj.parse(sourceText, parseOpts);
      } catch (e2) {
        throw new Error('[Luno AST Guard] Acorn failed to parse source AST: ' + e2.message);
      }
    }
  }

  static parseSpec(targetSpec) {
    if (!targetSpec || typeof targetSpec !== 'string' || !targetSpec.trim()) {
      throw new Error('[Luno AST Guard] Cannot parse targetSpec: targetSpec is empty.');
    }

    var clean = targetSpec.trim();
    if (clean.includes('@')) clean = clean.split('@').pop().trim();
    clean = clean.replace(/^(?:globalThis|window)\./, '');
    clean = clean.replace(/\s*\([\s\S]*?\)\s*$/, '').trim();

    var isStatic = null;
    var isAsync = false;
    var isGenerator = false;
    var kind = 'method';

    var leadingModRegex = /^(static|async|get|set)\s+/i;
    var matchLead;
    while ((matchLead = clean.match(leadingModRegex))) {
      var mod = matchLead[1].toLowerCase();
      if (mod === 'static') isStatic = true;
      else if (mod === 'async') isAsync = true;
      else if (mod === 'get') kind = 'get';
      else if (mod === 'set') kind = 'set';
      clean = clean.slice(matchLead[0].length).trim();
    }

    var className = '';
    var rawMember = '';

    if (clean.includes('.prototype.')) {
      var protoParts = clean.split('.prototype.');
      className = protoParts[0].trim();
      rawMember = protoParts[1].trim();
      if (isStatic === null) isStatic = false;
    } else if (clean.includes('.')) {
      var dotParts = clean.split('.');
      rawMember = dotParts.pop().trim();
      className = dotParts.join('.').trim();
    } else {
      rawMember = clean;
    }

    var memberTokens = rawMember.split(/\s+/);
    var actualMemberName = memberTokens[memberTokens.length - 1];

    for (var i = 0; i < memberTokens.length - 1; i++) {
      var tok = memberTokens[i].toLowerCase();
      if (tok === 'static') isStatic = true;
      else if (tok === 'async') isAsync = true;
      else if (tok === 'get') kind = 'get';
      else if (tok === 'set') kind = 'set';
      else if (tok === '*') isGenerator = true;
    }

    if (actualMemberName.startsWith('*')) {
      isGenerator = true;
      actualMemberName = actualMemberName.slice(1);
    }

    if (actualMemberName === 'constructor') {
      isStatic = false;
      kind = 'constructor';
    }

    return {
      className: className,
      memberName: actualMemberName,
      isStatic: isStatic,
      isAsync: isAsync,
      isGenerator: isGenerator,
      kind: kind
    };
  }

  static normalizeMethodCode(memberName, methodCode, isStatic, targetKind) {
    var rawStr = String(methodCode !== undefined && methodCode !== null ? methodCode : '').trim();
    if (!rawStr) {
      return (isStatic === true ? 'static ' : '') + memberName + '() {}';
    }

    var clean = rawStr;
    if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();

    if (/^(?:globalThis\.|window\.)?[A-Za-z0-9_$]+(?:\.prototype|\.)[A-Za-z0-9_$]+\s*=/.test(clean)) {
      var eqIdx = clean.indexOf('=');
      clean = clean.slice(eqIdx + 1).trim();
      if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();
    }

    var maxPasses = 20;
    while (maxPasses > 0 && (clean.startsWith('//') || clean.startsWith('/*'))) {
      maxPasses--;
      if (clean.startsWith('//')) {
        var nl = clean.indexOf('\n');
        clean = nl !== -1 ? clean.slice(nl + 1).trim() : '';
      } else if (clean.startsWith('/*')) {
        var endComment = clean.indexOf('*/');
        clean = endComment !== -1 ? clean.slice(endComment + 2).trim() : '';
      }
    }
    if (!clean) return (isStatic === true ? 'static ' : '') + memberName + '() {}';

    var firstBraceIdx = clean.indexOf('{');
    var headerPart = firstBraceIdx !== -1 ? clean.slice(0, firstBraceIdx).trim() : clean;
    var bodyPart = firstBraceIdx !== -1 ? clean.slice(firstBraceIdx).trim() : '{}';

    var hasStatic = /\bstatic\b/.test(headerPart) || (isStatic === true);
    var hasAsync = /\basync\b/.test(headerPart);
    var isGenerator = headerPart.includes('*');

    var isGet = (targetKind === 'get') || (targetKind !== 'set' && /(?:^|\s)get\s+/.test(headerPart) && memberName !== 'get');
    var isSet = (targetKind === 'set') || (targetKind !== 'get' && /(?:^|\s)set\s+/.test(headerPart) && memberName !== 'set');

    var params = '()';
    var pStart = headerPart.indexOf('(');
    var pEnd = headerPart.lastIndexOf(')');
    if (pStart !== -1 && pEnd !== -1 && pEnd > pStart) {
      params = headerPart.slice(pStart, pEnd + 1);
    }

    if (memberName === 'constructor') {
      return 'constructor' + params + ' ' + bodyPart;
    }

    var out = '';
    if (hasStatic) out += 'static ';
    if (hasAsync && !isGet && !isSet) out += 'async ';
    if (isGenerator) out += '*';
    if (isGet) out += 'get ';
    if (isSet) out += 'set ';

    out += memberName + params + ' ' + bodyPart;
    return String(out).trim();
  }

  static findClassNodes(ast, targetClassName) {
    var results = [];
    if (!ast || typeof ast !== 'object') return results;

    var walk = function(node, parent) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        var name = (node.id && node.id.name) ? node.id.name : null;
        if (!name && parent && parent.id && parent.id.name) {
          name = parent.id.name;
        }

        if (!targetClassName || name === targetClassName) {
          results.push({ node: node, name: name, bodyNode: node.body, range: node.range });
        }
      }

      for (var key in node) {
        if (key === 'parent') continue;
        var child = node[key];
        if (Array.isArray(child)) {
          for (var i = 0; i < child.length; i++) {
            if (child[i] && typeof child[i].type === 'string') walk(child[i], node);
          }
        } else if (child && typeof child.type === 'string') {
          walk(child, node);
        }
      }
    };

    walk(ast, null);
    if (results.length === 0 && targetClassName) {
      var all = LunoClassPatcher.findClassNodes(ast, null);
      if (all.length === 1) return all;
    }
    return results;
  }

  static findMemberInClass(classNode, memberName, isStatic, targetKind) {
    if (!classNode || !classNode.body || !Array.isArray(classNode.body.body)) {
      return { memberNode: null, availableMembers: [] };
    }

    var memberNode = null;
    var availableMembers = [];

    for (var i = 0; i < classNode.body.body.length; i++) {
      var member = classNode.body.body[i];
      if (member.type === 'MethodDefinition' || member.type === 'PropertyDefinition') {
        var keyName = member.key ? (member.key.name || member.key.value) : null;
        if (keyName) {
          var prefix = member.static ? 'static ' : '';
          availableMembers.push(prefix + keyName);
        }

        var staticMatch = (isStatic === null || isStatic === undefined) ? true : (Boolean(member.static) === Boolean(isStatic));
        var memberKind = member.kind || 'method';
        var kindMatch = targetKind === 'get' || targetKind === 'set' ? (memberKind === targetKind) : true;

        if (keyName === memberName && staticMatch && kindMatch) {
          memberNode = member;
        }
      }
    }

    return { memberNode: memberNode, availableMembers: availableMembers };
  }

  static patchMethodInSource(existingSource, targetSpec, methodCode, options) {
    if (!existingSource || typeof existingSource !== 'string' || !existingSource.trim()) {
      throw new Error('[Luno AST Guard] Cannot patch method: existingSource is empty.');
    }

    var parsed = LunoClassPatcher.parseSpec(targetSpec);
    var ast = LunoClassPatcher.parseAST(existingSource);
    var classNodes = LunoClassPatcher.findClassNodes(ast, parsed.className);

    if (classNodes.length === 0) {
      throw new Error('[Luno AST Guard] Target class "' + parsed.className + '" not found in source AST.');
    }

    var targetClassNode = classNodes[0].node || classNodes[0];
    var classBody = targetClassNode.body;
    var match = LunoClassPatcher.findMemberInClass(targetClassNode, parsed.memberName, parsed.isStatic, parsed.kind);
    var existingMemberNode = match.memberNode;

    var effectiveStatic = parsed.isStatic !== null ? parsed.isStatic : (existingMemberNode ? existingMemberNode.static : false);
    var cleanMethod = LunoClassPatcher.normalizeMethodCode(parsed.memberName, methodCode, effectiveStatic, parsed.kind);

    var indent = '  ';
    var rawLines = cleanMethod.split('\n');
    var formattedMethod = rawLines.map(line => line.trim().length > 0 ? indent + line.trim() : '').join('\n');

    if (existingMemberNode && existingMemberNode.range) {
      var startIdx = existingMemberNode.range[0];
      var endIdx = existingMemberNode.range[1];

      var before = existingSource.slice(0, startIdx).trimEnd();
      var after = existingSource.slice(endIdx).replace(/^[\r\n]+/, '');
      return before + '\n\n' + formattedMethod + '\n' + after;
    }

    var lastMember = classBody.body.length > 0 ? classBody.body[classBody.body.length - 1] : null;
    var insertPos = (lastMember && lastMember.range) ? lastMember.range[1] : (classBody.range[0] + 1);

    var beforeInsert = existingSource.slice(0, insertPos).trimEnd();
    var afterInsert = existingSource.slice(insertPos);

    return beforeInsert + '\n\n' + formattedMethod + '\n' + afterInsert.trimStart();
  }

  static deleteMethodInSource(existingSource, targetSpec) {
    var parsed = LunoClassPatcher.parseSpec(targetSpec);
    var ast = LunoClassPatcher.parseAST(existingSource);
    var classNodes = LunoClassPatcher.findClassNodes(ast, parsed.className);
    if (classNodes.length === 0) return existingSource;

    var targetClassNode = classNodes[0].node || classNodes[0];
    var match = LunoClassPatcher.findMemberInClass(targetClassNode, parsed.memberName, parsed.isStatic, parsed.kind);
    if (match.memberNode && match.memberNode.range) {
      var start = match.memberNode.range[0];
      var end = match.memberNode.range[1];
      return existingSource.slice(0, start).trimEnd() + '\n' + existingSource.slice(end).replace(/^[\r\n]+/, '');
    }
    return existingSource;
  }

  static extractFileTopology(sourceCode, filePath) {
    if (!sourceCode || typeof sourceCode !== 'string') return [];
    var ast = null;
    try {
      ast = LunoClassPatcher.parseAST(sourceCode);
    } catch (e) {
      return [];
    }

    var classes = [];
    var classNodes = LunoClassPatcher.findClassNodes(ast, null);
    classNodes.forEach(function(c) {
      var methods = [];
      if (c.bodyNode && Array.isArray(c.bodyNode.body)) {
        c.bodyNode.body.forEach(function(m) {
          if (m.key && m.key.name) {
            var prefix = m.static ? 'static ' : '';
            methods.push('  • ' + prefix + m.key.name + '()');
          }
        });
      }
      classes.push({ className: c.name || 'Anonymous', methods: methods });
    });
    return classes;
  }
}

globalThis.LunoClassPatcher = LunoClassPatcher;
if (typeof module !== 'undefined' && module.exports) module.exports = LunoClassPatcher;