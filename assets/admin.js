(function () {
    'use strict';

    function detectBlanks(text) {
        var nums = new Set();
        Array.from(text.matchAll(/\[\[(\d+)\]\]/g)).forEach(function (m) {
            nums.add(parseInt(m[1], 10));
        });
        return Array.from(nums).sort(function (a, b) { return a - b; });
    }

    function renderPreview(text, container) {
        container.textContent = '';
        text.split(/(\[\[\d+\]\])/g).forEach(function (part) {
            var m = part.match(/^\[\[(\d+)\]\]$/);
            if (m) {
                var inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'fb-input';
                inp.placeholder = m[1];
                inp.readOnly = true;
                inp.tabIndex = -1;
                inp.style.pointerEvents = 'none';
                inp.style.width = '60px';
                inp.style.minWidth = '60px';
                container.appendChild(inp);
            } else {
                part.split('\n').forEach(function (line, i, arr) {
                    container.appendChild(document.createTextNode(line));
                    if (i < arr.length - 1) container.appendChild(document.createElement('br'));
                });
            }
        });
    }

    function serializeAnswers() {
        var container = document.getElementById('fb-answers-container');
        var jsonField = document.getElementById('fb-answers-json');
        if (!container || !jsonField) return;
        var result = {};
        container.querySelectorAll('.fb-blank-section').forEach(function (section) {
            var n = section.getAttribute('data-blank');
            var values = [];
            section.querySelectorAll('.fb-answer-input').forEach(function (inp) {
                var v = inp.value.trim();
                if (v) values.push(v);
            });
            if (values.length) result[n] = values;
        });
        jsonField.value = JSON.stringify(result);
    }

    function updateBadge(section) {
        var count = section.querySelectorAll('.fb-answer-input').length;
        var badge = section.querySelector('.fb-count-badge');
        if (badge) badge.textContent = count + ' answer' + (count !== 1 ? 's' : '');
    }

    function addAnswerRow(list, value, section) {
        var row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2 mb-1';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm fb-answer-input';
        input.placeholder = 'Valid answer (case-insensitive)';
        input.value = value || '';
        input.addEventListener('input', serializeAnswers);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm flex-shrink-0';
        var icon = document.createElement('i');
        icon.className = 'fas fa-times';
        removeBtn.appendChild(icon);
        removeBtn.title = 'Remove this answer';
        removeBtn.addEventListener('click', function () {
            row.remove();
            updateBadge(section);
            serializeAnswers();
        });

        row.appendChild(input);
        row.appendChild(removeBtn);
        list.appendChild(row);
        updateBadge(section);
        serializeAnswers();
    }

    function buildAnswerSection(n, answers) {
        var section = document.createElement('div');
        section.className = 'card mb-2 fb-blank-section';
        section.setAttribute('data-blank', String(n));

        var header = document.createElement('div');
        header.className = 'card-header d-flex align-items-center py-2 gap-2';

        var title = document.createElement('strong');
        title.appendChild(document.createTextNode('Blank '));
        var code = document.createElement('code');
        code.textContent = '[[' + n + ']]';
        title.appendChild(code);

        var badge = document.createElement('span');
        badge.className = 'badge bg-secondary fb-count-badge ms-1';
        badge.textContent = '0 answers';

        header.appendChild(title);
        header.appendChild(badge);

        var body = document.createElement('div');
        body.className = 'card-body py-2';

        var list = document.createElement('div');
        list.className = 'fb-answers-list mb-2';

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-outline-success btn-sm';
        var addIcon = document.createElement('i');
        addIcon.className = 'fas fa-plus me-1';
        addBtn.appendChild(addIcon);
        addBtn.appendChild(document.createTextNode('Add answer'));
        addBtn.addEventListener('click', function () {
            addAnswerRow(list, '', section);
        });

        body.appendChild(list);
        body.appendChild(addBtn);
        section.appendChild(header);
        section.appendChild(body);

        var rows = (answers && answers.length) ? answers : [''];
        rows.forEach(function (v) { addAnswerRow(list, v, section); });

        return section;
    }

    function loadExistingAnswers(challengeId, onDone) {
        var base = window.FB_API_BASE || '';
        fetch(base + '/challenges/' + challengeId + '/answers', {
            credentials: 'same-origin',
        })
        .then(function (r) { return r.json(); })
        .then(function (data) { onDone(data.success ? data.answers : {}); })
        .catch(function () { onDone({}); });
    }

    function renderAnswerSections(blanks, existingAnswers) {
        var container = document.getElementById('fb-answers-container');
        if (!container) return;

        while (container.firstChild) container.removeChild(container.firstChild);

        if (blanks.length === 0) {
            var msg = document.createElement('p');
            msg.className = 'text-muted small';
            var ic = document.createElement('i');
            ic.className = 'fas fa-info-circle me-1';
            msg.appendChild(ic);
            msg.appendChild(document.createTextNode('No blanks detected. Check the syntax '));
            var codeEl = document.createElement('code');
            codeEl.textContent = '[[1]]';
            msg.appendChild(codeEl);
            msg.appendChild(document.createTextNode('.'));
            container.appendChild(msg);
            return;
        }

        blanks.forEach(function (n) {
            container.appendChild(buildAnswerSection(n, existingAnswers[String(n)] || []));
        });
        serializeAnswers();
    }

    function doDetect(textarea, callback) {
        var blanks = detectBlanks(textarea.value);
        if (window.FB_CHALLENGE_ID) {
            loadExistingAnswers(window.FB_CHALLENGE_ID, function (existing) {
                callback(blanks, existing);
            });
        } else {
            callback(blanks, {});
        }
    }

    function init() {
        var textarea = document.getElementById('fb-blank-text-input');
        var detectBtn = document.getElementById('fb-detect-btn');
        var previewArea = document.getElementById('fb-preview-area');
        var previewContent = document.getElementById('fb-preview-content');

        if (!textarea || !detectBtn) return;

        textarea.addEventListener('input', function () {
            if (!textarea.value.trim()) { previewArea.style.display = 'none'; return; }
            renderPreview(textarea.value, previewContent);
            previewArea.style.display = 'block';
        });
        if (textarea.value.trim()) {
            renderPreview(textarea.value, previewContent);
            previewArea.style.display = 'block';
        }

        detectBtn.addEventListener('click', function () {
            doDetect(textarea, renderAnswerSections);
        });

        var form = textarea.closest('form');
        if (form) form.addEventListener('submit', serializeAnswers);

        if (textarea.value.trim()) doDetect(textarea, renderAnswerSections);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
