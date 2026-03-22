CTFd._internal.challenge.data = undefined;
CTFd._internal.challenge.preRender = function () {};

CTFd._functions.challenge.displaySubmissionResponse = function (response) {
    if (!response || !response.data) return;

    if (response.data.status === 'already_solved') {
        response.data.message = 'You have already solved this!';
        return;
    }

    try {
        var raw = response.data.message;
        var jsonMatch = raw.match(/\{.*\}/);
        if (!jsonMatch) return;
        var feedback = JSON.parse(jsonMatch[0]);
        var suffix = raw.replace(jsonMatch[0], '').trim();
        var correct = feedback.correct || [];
        var incorrect = feedback.incorrect || [];

        document.querySelectorAll('#fb-blank-zone .fb-input').forEach(function (inp) {
            var n = parseInt(inp.getAttribute('data-blank'), 10);
            inp.classList.remove('fb-correct', 'fb-incorrect');
            if (correct.indexOf(n) !== -1) inp.classList.add('fb-correct');
            if (incorrect.indexOf(n) !== -1) inp.classList.add('fb-incorrect');
        });

        if (response.data.status === 'correct') {
            response.data.message = 'Correct';
        } else {
            var parts = [];
            if (correct.length > 0) parts.push('Correct: ' + correct.join(', '));
            if (incorrect.length > 0) parts.push('Incorrect: ' + incorrect.join(', '));
            if (suffix) parts.push(suffix);
            response.data.message = parts.join(' | ');
        }
    } catch (e) {}
};

CTFd._internal.challenge.postRender = function () {
    window.Alpine.nextTick(function () {
        var zone = document.getElementById('fb-blank-zone');
        if (!zone) return;

        var blankText = zone.getAttribute('data-blank-text') || '';

        while (zone.firstChild) zone.removeChild(zone.firstChild);

        blankText.split(/(\[\[\d+\]\])/g).forEach(function (part) {
            var m = part.match(/^\[\[(\d+)\]\]$/);
            if (m) {
                var n = m[1];
                var wrap = document.createElement('span');
                wrap.className = 'fb-blank-wrap';

                var sup = document.createElement('sup');
                sup.className = 'fb-label';
                sup.textContent = n;

                var inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'fb-input';
                inp.setAttribute('data-blank', n);
                inp.autocomplete = 'off';
                inp.spellcheck = false;
                inp.maxLength = 100;
                inp.addEventListener('input', function () {
                    inp.style.width = Math.min(Math.max(inp.value.length, 5) * 0.7 + 1, 20) + 'em';
                });

                wrap.appendChild(sup);
                wrap.appendChild(inp);
                zone.appendChild(wrap);
            } else {
                part.split('\n').forEach(function (line, i, arr) {
                    zone.appendChild(document.createTextNode(line));
                    if (i < arr.length - 1) zone.appendChild(document.createElement('br'));
                });
            }
        });

        var submitBtn = document.getElementById('challenge-submit');
        if (submitBtn && !submitBtn._fbHandler) {
            submitBtn._fbHandler = true;
            submitBtn.addEventListener('click', function () {
                var answers = {};
                document.querySelectorAll('#fb-blank-zone .fb-input').forEach(function (inp) {
                    answers[inp.getAttribute('data-blank')] = inp.value.trim();
                });
                var challengeInput = document.getElementById('challenge-input');
                if (challengeInput) {
                    challengeInput.value = JSON.stringify(answers);
                    challengeInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, true);
        }
    });
};
