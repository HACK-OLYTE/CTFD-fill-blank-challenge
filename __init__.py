import json
import os
import re
import unicodedata

from flask import Blueprint, jsonify
from CTFd.models import Challenges, Solves, Fails, db
from CTFd.plugins import register_plugin_assets_directory, register_plugin_stylesheet
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge, ChallengeResponse
from CTFd.utils.user import get_ip
from CTFd.utils.decorators import admins_only

_BLANK_RE = re.compile(r'\[\[(\d+)\]\]')

# Derived from the actual directory name — works regardless of folder name.
_PLUGIN_DIR    = os.path.basename(os.path.dirname(os.path.abspath(__file__)))
_ASSETS        = f"/plugins/{_PLUGIN_DIR}/assets"
_BLUEPRINT_NAME = _PLUGIN_DIR.replace("-", "_")


def _normalize(text: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', text.lower())
        if unicodedata.category(c) != 'Mn'
    )


class FillBlankChallenge(Challenges):
    __mapper_args__ = {"polymorphic_identity": "fill_blank"}

    id = db.Column(
        db.Integer,
        db.ForeignKey("challenges.id", ondelete="CASCADE"),
        primary_key=True,
    )
    blank_text  = db.Column(db.Text, nullable=False, server_default="")
    blank_count = db.Column(db.Integer, nullable=False, server_default="0")


class FillBlankAnswer(db.Model):
    __tablename__ = "fill_blank_answers"

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    challenge_id = db.Column(
        db.Integer,
        db.ForeignKey("challenges.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blank_number = db.Column(db.Integer, nullable=False)
    answer_text  = db.Column(db.String(512), nullable=False)


class FillBlankChallengeType(BaseChallenge):
    id   = "fill_blank"
    name = "fill_blank"
    templates = {
        "create": f"{_ASSETS}/create.html",
        "update": f"{_ASSETS}/update.html",
        "view":   f"{_ASSETS}/view.html",
    }
    scripts = {
        "create": f"{_ASSETS}/admin.js",
        "update": f"{_ASSETS}/admin.js",
        "view":   f"{_ASSETS}/view.js",
    }
    route     = f"{_ASSETS}/"
    blueprint = Blueprint(
        _BLUEPRINT_NAME,
        __name__,
        template_folder="templates",
        static_folder="assets",
    )
    challenge_model = FillBlankChallenge

    @staticmethod
    def _count_blanks(text: str) -> int:
        nums = {int(m) for m in _BLANK_RE.findall(text)}
        return max(nums) if nums else 0

    @classmethod
    def _save_answers(cls, challenge_id: int, answers_dict: dict) -> None:
        FillBlankAnswer.query.filter_by(challenge_id=challenge_id).delete()
        for blank_num_str, answer_list in answers_dict.items():
            try:
                blank_num = int(blank_num_str)
            except (ValueError, TypeError):
                continue
            if isinstance(answer_list, str):
                answer_list = [answer_list]
            for ans in answer_list:
                ans = str(ans).strip()
                if ans:
                    db.session.add(FillBlankAnswer(
                        challenge_id=challenge_id,
                        blank_number=blank_num,
                        answer_text=ans[:512],
                    ))

    @staticmethod
    def _parse_answers(raw) -> dict:
        if not raw:
            return {}
        if isinstance(raw, dict):
            return raw
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {}

    @classmethod
    def _extract_submission(cls, data: dict) -> dict:
        """Read answers from 'answers' (dict) or 'submission' (JSON string from core theme)."""
        answers = data.get("answers") or {}
        if not answers:
            raw = data.get("submission", "")
            if raw:
                try:
                    answers = json.loads(raw)
                except (ValueError, TypeError):
                    answers = {}
        return cls._parse_answers(answers) if isinstance(answers, str) else answers

    @classmethod
    def create(cls, request):
        data = request.form or request.get_json() or {}
        text = str(data.get("blank_text", "")).strip()
        challenge = cls.challenge_model(
            name=str(data.get("name", "")),
            description=str(data.get("description", "")),
            category=str(data.get("category", "")),
            value=int(data.get("value", 0) or 0),
            state=str(data.get("state", "visible")),
            max_attempts=int(data.get("max_attempts", 0) or 0),
            type="fill_blank",
            blank_text=text,
            blank_count=cls._count_blanks(text),
        )
        db.session.add(challenge)
        db.session.flush()
        cls._save_answers(challenge.id, cls._parse_answers(data.get("answers")))
        db.session.commit()
        return challenge

    @classmethod
    def read(cls, challenge):
        data = super().read(challenge)
        data["blank_text"]  = challenge.blank_text
        data["blank_count"] = challenge.blank_count
        return data

    @classmethod
    def update(cls, challenge, request):
        data = request.form or request.get_json() or {}
        for attr in ("name", "description", "category", "value", "state",
                     "max_attempts", "next_id", "attribution",
                     "connection_info", "module", "sub_module_id"):
            if attr in data:
                val = data[attr]
                if attr in ("value", "max_attempts"):
                    try:
                        val = int(val)
                    except (ValueError, TypeError):
                        val = 0
                elif attr == "sub_module_id":
                    try:
                        val = int(val) if val else None
                    except (ValueError, TypeError):
                        val = None
                setattr(challenge, attr, val)
        if "blank_text" in data:
            text = str(data["blank_text"]).strip()
            challenge.blank_text  = text
            challenge.blank_count = cls._count_blanks(text)
        if "answers" in data:
            cls._save_answers(challenge.id, cls._parse_answers(data["answers"]))
        db.session.commit()
        return challenge

    @classmethod
    def delete(cls, challenge):
        FillBlankAnswer.query.filter_by(challenge_id=challenge.id).delete()
        Solves.query.filter_by(challenge_id=challenge.id).delete()
        Fails.query.filter_by(challenge_id=challenge.id).delete()
        db.session.delete(challenge)
        db.session.commit()

    @classmethod
    def attempt(cls, challenge, request):
        data = request.get_json() or request.form or {}
        submitted = cls._extract_submission(data)

        if not submitted:
            return ChallengeResponse(
                status="incorrect",
                message=json.dumps({"error": "No answers submitted."}),
            )

        if any(len(str(v)) > 100 for v in submitted.values()):
            return ChallengeResponse(
                status="incorrect",
                message=json.dumps({"error": "Each answer must be 100 characters or fewer."}),
            )

        valid_rows = FillBlankAnswer.query.filter_by(challenge_id=challenge.id).all()
        valid_by_blank: dict[int, list[str]] = {}
        for row in valid_rows:
            valid_by_blank.setdefault(row.blank_number, []).append(_normalize(row.answer_text))

        correct, incorrect = [], []
        for n in range(1, challenge.blank_count + 1):
            user_ans = _normalize(str(submitted.get(str(n), "")).strip())
            if user_ans and user_ans in valid_by_blank.get(n, []):
                correct.append(n)
            else:
                incorrect.append(n)

        all_ok = (len(incorrect) == 0 and len(correct) == challenge.blank_count)
        feedback = json.dumps({
            "correct":   correct,
            "incorrect": incorrect,
            "total":     challenge.blank_count,
        }, ensure_ascii=False)

        if all_ok:
            return ChallengeResponse(status="correct", message=feedback)
        return ChallengeResponse(status="incorrect", message=feedback)

    @classmethod
    def _extract_provided(cls, data: dict) -> str:
        answers = cls._extract_submission(data)
        if not answers:
            return ""
        parts = sorted(answers.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)
        return ", ".join(f"{k}: {v}" for k, v in parts)

    @classmethod
    def solve(cls, user, team, challenge, request):
        data = request.get_json() or request.form or {}
        db.session.add(Solves(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=cls._extract_provided(data),
        ))
        db.session.commit()

    @classmethod
    def fail(cls, user, team, challenge, request):
        data = request.get_json() or request.form or {}
        db.session.add(Fails(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=cls._extract_provided(data),
        ))
        db.session.commit()


def load(app):
    with app.app_context():
        db.create_all()

    import logging
    logging.getLogger("CTFd").info("CTFd - Fill Blank Challenges OK")

    @app.context_processor
    def _inject_plugin_dir():
        return {"_fb_plugin_dir": _PLUGIN_DIR}

    @app.route(f"/plugins/{_PLUGIN_DIR}/api/challenges/<int:challenge_id>/answers")
    @admins_only
    def fb_get_answers(challenge_id):
        rows = FillBlankAnswer.query.filter_by(challenge_id=challenge_id).all()
        result: dict[str, list[str]] = {}
        for row in rows:
            result.setdefault(str(row.blank_number), []).append(row.answer_text)
        return jsonify({"success": True, "answers": result})

    register_plugin_assets_directory(app, base_path=f"{_ASSETS}/")
    register_plugin_stylesheet(f"{_ASSETS}/fill_blank.css")

    app.register_blueprint(FillBlankChallengeType.blueprint)
    CHALLENGE_CLASSES["fill_blank"] = FillBlankChallengeType
