var TriviaGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "TriviaGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var trivia = tb.triviaGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");
    this._common = common;
    this._trivia = trivia;
    this._questions = (trivia.questions || []).slice();
    if (trivia.shuffleQuestions) {
      for (var i = this._questions.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = this._questions[i];
        this._questions[i] = this._questions[j];
        this._questions[j] = t;
      }
    }
    this._questionCount =
      Math.min(trivia.questionCount || 10, this._questions.length) ||
      this._questions.length;
    this._currentIndex = 0;
    this._scores = {};
    TurnManager.init(common.players || [], 0);
    for (var i = 0; i < TurnManager.players.length; i++) {
      this._scores[TurnManager.players[i].index] = 0;
    }
    this._answered = false;
    this._showNext = false;
    this._loadQuestion();
  },

  _loadQuestion: function () {
    if (
      this._currentIndex >= this._questionCount ||
      this._currentIndex >= this._questions.length
    ) {
      this._endTrivia();
      return;
    }
    var q = this._questions[this._currentIndex];
    var answers = (q.answers || []).slice();
    if (this._trivia.shuffleAnswers) {
      var correctIdx = q.correctIndex;
      var correctVal = answers[correctIdx];
      for (var i = answers.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = answers[i];
        answers[i] = answers[j];
        answers[j] = tmp;
      }
      for (var k = 0; k < answers.length; k++) {
        if (answers[k] === correctVal) {
          q._shuffledCorrectIndex = k;
          break;
        }
      }
    } else {
      q._shuffledCorrectIndex = q.correctIndex;
    }
    this._currentQuestion = q;
    this._currentAnswers = answers;
    this._answered = false;
    this._renderQuestion();
  },

  _renderQuestion: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    if (this._questionText) this._questionText.destroy();
    if (this._progressText) this._progressText.destroy();
    if (this._answerButtons) {
      for (var i = 0; i < this._answerButtons.length; i++) {
        this._answerButtons[i].destroy();
      }
    }
    var q = this._currentQuestion;
    var fontSize = this._trivia.questionFontSize || 24;
    this._questionText = this.add.text(w / 2, 120, q.question, {
      fontSize: fontSize + "px",
      fill: this._trivia.questionColor || "#ffffff",
      wordWrap: { width: w - 80 },
      align: "center",
    });
    this._questionText.setOrigin(0.5, 0);

    var progress = this.add.text(
      w / 2,
      60,
      "Question " + (this._currentIndex + 1) + " of " + this._questionCount,
      {
        fontSize: "18px",
        fill: this._common.secondaryTextColor || "#aaaaaa",
      },
    );
    progress.setOrigin(0.5);
    this._progressText = progress;

    var self = this;
    this._answerButtons = [];
    var y = 220;
    for (var i = 0; i < this._currentAnswers.length; i++) {
      (function (idx) {
        var btn = self.add.text(
          w / 2,
          y + idx * 50,
          self._currentAnswers[idx],
          {
            fontSize: (self._trivia.answerFontSize || 18) + "px",
            fill: self._trivia.answerBoxColor || "#333366",
            backgroundColor: self._trivia.answerBoxColor || "#333366",
            padding: { x: 16, y: 8 },
          },
        );
        btn.setOrigin(0.5);
        btn.setInteractive({ useHandCursor: true });
        btn.setData("index", idx);
        btn.on("pointerdown", function () {
          self._onAnswer(idx);
        });
        self._answerButtons.push(btn);
      })(i);
    }
  },

  _onAnswer: function (answerIndex) {
    if (this._answered) return;
    this._answered = true;
    var q = this._currentQuestion;
    var correctIdx =
      q._shuffledCorrectIndex != null
        ? q._shuffledCorrectIndex
        : q.correctIndex;
    var correct = answerIndex === correctIdx;
    var points = correct
      ? q.points || this._trivia.pointsPerCorrect || 100
      : this._trivia.pointsPerWrong || 0;
    TurnManager.addScore(0, points);
    this._scores[0] = (this._scores[0] || 0) + points;

    var correctColor = this._trivia.correctColor || "#44aa44";
    var wrongColor = this._trivia.wrongColor || "#aa4444";
    this._answerButtons[answerIndex].setFill(
      correct ? correctColor : wrongColor,
    );
    this._answerButtons[correctIdx].setFill(correctColor);

    var self = this;
    var delay = 1500;
    if (this._trivia.showExplanation && q.explanation) {
      delay = 2500;
      var exp = this.add.text(
        this._common.viewport.width / 2,
        this._common.viewport.height - 80,
        q.explanation,
        {
          fontSize: "16px",
          fill: this._common.secondaryTextColor || "#aaaaaa",
          wordWrap: { width: this._common.viewport.width - 80 },
          align: "center",
        },
      );
      exp.setOrigin(0.5);
    }
    this.time.delayedCall(delay, function () {
      self._currentIndex++;
      self._loadQuestion();
    });
  },

  _endTrivia: function () {
    var scores = TurnManager.players.map(function (p) {
      return { name: p.name, score: p.score };
    });
    var winner = null;
    var maxScore = -1;
    for (var i = 0; i < TurnManager.players.length; i++) {
      if (TurnManager.players[i].score > maxScore) {
        maxScore = TurnManager.players[i].score;
        winner = TurnManager.players[i];
      }
    }
    this.scene.start("TBGameOverScene", {
      winner: winner,
      isDraw: false,
      scores: scores,
    });
  },
});
