var WordGameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: "WordGameScene" });
  },

  create: function () {
    var config = GameUtils.getConfig();
    var tb = (config && config.turnBased) || {};
    var common = tb.common || {};
    var wordConfig = tb.wordGame || {};
    var viewport = common.viewport || { width: 800, height: 600 };
    var w = viewport.width;
    var h = viewport.height;
    var subType = wordConfig.subType || "hangman";

    this.cameras.main.setBackgroundColor(common.backgroundColor || "#1a1a2e");
    this._common = common;
    this._wordConfig = wordConfig;
    this._subType = subType;

    if (subType === "hangman") {
      this._initHangman(w, h);
    } else {
      this._initWordle(w, h);
    }
  },

  _initHangman: function (w, h) {
    var wordConfig = this._wordConfig;
    var wordSource = wordConfig.wordSource || "built-in";
    var customWords = wordConfig.customWords || [];
    var category = wordConfig.wordCategory || "mixed";
    var minLen = wordConfig.minWordLength || 4;
    var maxLen = wordConfig.maxWordLength || 8;

    if (wordSource === "custom-list" && customWords.length > 0) {
      this._word =
        customWords[
          Math.floor(Math.random() * customWords.length)
        ].toUpperCase();
    } else {
      this._word = WordList.getRandomWord(category, minLen, maxLen);
    }

    this._guessed = [];
    this._wrongCount = 0;
    var hangman = wordConfig.hangman || {};
    this._maxWrong =
      hangman.maxWrongGuesses != null ? hangman.maxWrongGuesses : 6;
    this._drawStyle = hangman.drawStyle || "classic";

    this._renderHangmanWord();
    this._renderAlphabet();
    this._renderGallows();
    if (wordConfig.showHint && wordConfig.hintText) {
      this.add
        .text(w / 2, h - 100, wordConfig.hintText, {
          fontSize: "18px",
          fill: this._common.secondaryTextColor || "#aaaaaa",
        })
        .setOrigin(0.5);
    }
  },

  _renderHangmanWord: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    var display = "";
    for (var i = 0; i < this._word.length; i++) {
      var letter = this._word[i];
      display += this._guessed.indexOf(letter) >= 0 ? letter + " " : "_ ";
    }
    if (this._wordText) this._wordText.destroy();
    this._wordText = this.add.text(w / 2, h / 2 - 80, display.trim(), {
      fontSize: (this._wordConfig.letterSize || 32) + "px",
      fill: this._wordConfig.letterColor || "#ffffff",
    });
    this._wordText.setOrigin(0.5);
  },

  _renderGallows: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    var maxWrong = this._maxWrong;
    var wrong = this._wrongCount;
    var style = this._drawStyle;
    var hangman = this._wordConfig.hangman || {};
    var bodyColor = hangman.bodyColor
      ? parseInt(String(hangman.bodyColor).replace("#", ""), 16)
      : 0xffffff;
    var gallowsColor = hangman.gallowsColor
      ? parseInt(String(hangman.gallowsColor).replace("#", ""), 16)
      : 0x888888;
    var gx = w - 180;
    var gy = h / 2;

    if (this._gallowsGraphics) this._gallowsGraphics.destroy();
    this._gallowsGraphics = this.add.graphics();

    if (style === "classic") {
      this._gallowsGraphics.lineStyle(4, gallowsColor, 1);
      this._gallowsGraphics.strokeLineShape(
        new Phaser.Geom.Line(gx - 60, gy + 80, gx + 60, gy + 80),
      );
      this._gallowsGraphics.strokeLineShape(
        new Phaser.Geom.Line(gx, gy + 80, gx, gy - 100),
      );
      this._gallowsGraphics.strokeLineShape(
        new Phaser.Geom.Line(gx, gy - 100, gx + 50, gy - 100),
      );
      this._gallowsGraphics.strokeLineShape(
        new Phaser.Geom.Line(gx + 50, gy - 100, gx + 50, gy - 80),
      );
      if (wrong >= 1) {
        this._gallowsGraphics.lineStyle(3, bodyColor, 1);
        this._gallowsGraphics.strokeCircle(gx + 50, gy - 65, 15);
      }
      if (wrong >= 2) {
        this._gallowsGraphics.strokeLineShape(
          new Phaser.Geom.Line(gx + 50, gy - 50, gx + 50, gy + 10),
        );
      }
      if (wrong >= 3) {
        this._gallowsGraphics.strokeLineShape(
          new Phaser.Geom.Line(gx + 50, gy - 30, gx + 20, gy - 10),
        );
      }
      if (wrong >= 4) {
        this._gallowsGraphics.strokeLineShape(
          new Phaser.Geom.Line(gx + 50, gy - 30, gx + 80, gy - 10),
        );
      }
      if (wrong >= 5) {
        this._gallowsGraphics.strokeLineShape(
          new Phaser.Geom.Line(gx + 50, gy + 10, gx + 25, gy + 50),
        );
      }
      if (wrong >= 6) {
        this._gallowsGraphics.strokeLineShape(
          new Phaser.Geom.Line(gx + 50, gy + 10, gx + 75, gy + 50),
        );
      }
    } else if (style === "countdown") {
      this.add
        .text(gx, gy - 20, "" + (maxWrong - wrong), {
          fontSize: "48px",
          fill: "#ffffff",
        })
        .setOrigin(0.5);
    }
  },

  _renderAlphabet: function () {
    var w = this._common.viewport.width || 800;
    var h = this._common.viewport.height || 600;
    if (this._letterButtons) {
      for (var i = 0; i < this._letterButtons.length; i++) {
        this._letterButtons[i].destroy();
      }
    }
    this._letterButtons = [];
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var startX = w / 2 - 260;
    var y = h / 2 + 40;
    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 13; col++) {
        var idx = row * 13 + col;
        if (idx >= letters.length) break;
        var letter = letters[idx];
        var guessed = this._guessed.indexOf(letter) >= 0;
        var x = startX + col * 42;
        var yy = y + row * 36;
        var t = this.add.text(x, yy, letter, {
          fontSize: "22px",
          fill: guessed
            ? "#555555"
            : this._common.primaryTextColor || "#ffffff",
        });
        t.setOrigin(0.5);
        if (!guessed) {
          t.setInteractive({ useHandCursor: true });
          var self = this;
          var l = letter;
          t.on("pointerdown", function () {
            self._guessLetter(l);
          });
        }
        this._letterButtons.push(t);
      }
    }
  },

  _guessLetter: function (letter) {
    if (this._guessed.indexOf(letter) >= 0) return;
    this._guessed.push(letter);
    var inWord = this._word.indexOf(letter) >= 0;
    if (!inWord) {
      this._wrongCount++;
      this._renderGallows();
    }
    this._renderHangmanWord();
    this._renderAlphabet();

    var won = true;
    for (var i = 0; i < this._word.length; i++) {
      if (this._guessed.indexOf(this._word[i]) < 0) {
        won = false;
        break;
      }
    }
    if (won) {
      this._endWordGame(true);
      return;
    }
    if (this._wrongCount >= this._maxWrong) {
      this._endWordGame(false);
    }
  },

  _initWordle: function (w, h) {
    var wordle = this._wordConfig.wordle || {};
    var wordLength = wordle.wordLength || 5;
    var maxAttempts = wordle.maxAttempts || 6;
    var customWords = this._wordConfig.customWords || [];
    if (customWords.length > 0) {
      var filtered = [];
      for (var i = 0; i < customWords.length; i++) {
        if (customWords[i].length === wordLength) filtered.push(customWords[i]);
      }
      this._targetWord =
        filtered.length > 0
          ? filtered[Math.floor(Math.random() * filtered.length)].toUpperCase()
          : WordList.getWordleWord(wordLength);
    } else {
      this._targetWord = WordList.getWordleWord(wordLength);
    }
    this._wordLength = wordLength;
    this._maxAttempts = maxAttempts;
    this._currentRow = 0;
    this._currentCol = 0;
    this._guesses = [];
    for (var r = 0; r < maxAttempts; r++) {
      this._guesses[r] = [];
      for (var c = 0; c < wordLength; c++) {
        this._guesses[r][c] = { letter: "", state: "" };
      }
    }
    this._wordleTiles = [];
    this._renderWordleGrid(w, h);
    this._renderWordleKeyboard(w, h);
  },

  _renderWordleGrid: function (w, h) {
    var wordle = this._wordConfig.wordle || {};
    var tileSize = wordle.tileSize || 62;
    var correctColor = wordle.correctColor || "#538d4e";
    var misplacedColor = wordle.misplacedColor || "#b59f3b";
    var wrongColor = wordle.wrongColor || "#3a3a3c";
    var totalW = this._wordLength * tileSize + (this._wordLength - 1) * 4;
    var totalH = this._maxAttempts * tileSize + (this._maxAttempts - 1) * 4;
    var startX = (w - totalW) / 2 + tileSize / 2 + 2;
    var startY = (h - totalH) / 2 - 60 + tileSize / 2 + 2;

    for (var r = 0; r < this._maxAttempts; r++) {
      this._wordleTiles[r] = [];
      for (var c = 0; c < this._wordLength; c++) {
        var x = startX + c * (tileSize + 4);
        var y = startY + r * (tileSize + 4);
        var g = this.add.graphics();
        g.fillStyle(0x3a3a3c, 1);
        g.fillRoundedRect(
          x - tileSize / 2,
          y - tileSize / 2,
          tileSize,
          tileSize,
          4,
        );
        g.lineStyle(2, 0x565758, 1);
        g.strokeRoundedRect(
          x - tileSize / 2,
          y - tileSize / 2,
          tileSize,
          tileSize,
          4,
        );
        var t = this.add.text(x, y, "", { fontSize: "28px", color: "#ffffff" });
        t.setOrigin(0.5);
        this._wordleTiles[r][c] = { graphics: g, text: t, x: x, y: y };
      }
    }
    this._wordleTileSize = tileSize;
    this._wordleCorrect = correctColor;
    this._wordleMisplaced = misplacedColor;
    this._wordleWrong = wrongColor;
  },

  _renderWordleKeyboard: function (w, h) {
    var rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    var keyW = 36;
    var keyH = 44;
    this._keyButtons = {};
    var startY = h - 120;
    for (var row = 0; row < rows.length; row++) {
      var str = rows[row];
      var totalKeyW = str.length * (keyW + 4) - 4;
      var startX = (w - totalKeyW) / 2 + keyW / 2 + 2;
      for (var i = 0; i < str.length; i++) {
        var letter = str[i];
        var x = startX + i * (keyW + 4);
        var t = this.add.text(x, startY + row * (keyH + 6), letter, {
          fontSize: "18px",
          color: "#ffffff",
        });
        t.setOrigin(0.5);
        t.setInteractive({ useHandCursor: true });
        var self = this;
        t.on(
          "pointerdown",
          function (l) {
            self._wordleType(l);
          }.bind(null, letter),
        );
        this._keyButtons[letter] = { text: t, color: null };
      }
    }
    var enterBtn = this.add.text(
      w / 2 - 120,
      startY + 2 * (keyH + 6),
      "Enter",
      {
        fontSize: "14px",
        color: "#ffffff",
      },
    );
    enterBtn.setOrigin(0.5);
    enterBtn.setInteractive({ useHandCursor: true });
    enterBtn.on(
      "pointerdown",
      function () {
        this._wordleSubmit();
      },
      this,
    );
    var backBtn = this.add.text(w / 2 + 120, startY + 2 * (keyH + 6), "Back", {
      fontSize: "14px",
      color: "#ffffff",
    });
    backBtn.setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on(
      "pointerdown",
      function () {
        this._wordleBack();
      },
      this,
    );
  },

  _wordleType: function (letter) {
    if (this._currentCol >= this._wordLength) return;
    this._guesses[this._currentRow][this._currentCol].letter = letter;
    this._wordleTiles[this._currentRow][this._currentCol].text.setText(letter);
    this._currentCol++;
  },

  _wordleBack: function () {
    if (this._currentCol <= 0) return;
    this._currentCol--;
    this._guesses[this._currentRow][this._currentCol].letter = "";
    this._wordleTiles[this._currentRow][this._currentCol].text.setText("");
  },

  _wordleSubmit: function () {
    if (this._currentCol !== this._wordLength) return;
    var row = this._currentRow;
    var word = "";
    for (var c = 0; c < this._wordLength; c++) {
      word += this._guesses[row][c].letter;
    }
    var wordLower = word.toLowerCase();
    if (!WordList.isValidWord(wordLower)) {
      return;
    }
    word = word.toUpperCase();
    var target = this._targetWord;
    var states = [];
    var used = {};
    for (var c = 0; c < this._wordLength; c++) {
      if (target[c] === word[c]) {
        states[c] = "correct";
        used[c] = true;
      } else {
        states[c] = "";
      }
    }
    for (var c = 0; c < this._wordLength; c++) {
      if (states[c] === "correct") continue;
      for (var j = 0; j < this._wordLength; j++) {
        if (!used[j] && target[j] === word[c]) {
          states[c] = "misplaced";
          used[j] = true;
          break;
        }
      }
      if (states[c] !== "misplaced") states[c] = "wrong";
    }
    for (var c = 0; c < this._wordLength; c++) {
      this._guesses[row][c].state = states[c];
      var tile = this._wordleTiles[row][c];
      var color =
        states[c] === "correct"
          ? this._wordleCorrect
          : states[c] === "misplaced"
            ? this._wordleMisplaced
            : this._wordleWrong;
      var hex = parseInt(color.replace("#", ""), 16);
      tile.graphics.clear();
      tile.graphics.fillStyle(hex, 1);
      tile.graphics.fillRoundedRect(
        tile.x - this._wordleTileSize / 2,
        tile.y - this._wordleTileSize / 2,
        this._wordleTileSize,
        this._wordleTileSize,
        4,
      );
      if (this._keyButtons[word[c].toUpperCase()]) {
        this._keyButtons[word[c].toUpperCase()].color = color;
        this._keyButtons[word[c].toUpperCase()].text.setColor(color);
      }
    }
    var won = true;
    for (var c = 0; c < this._wordLength; c++) {
      if (states[c] !== "correct") {
        won = false;
        break;
      }
    }
    if (won) {
      this._endWordGame(true);
      return;
    }
    this._currentRow++;
    this._currentCol = 0;
    if (this._currentRow >= this._maxAttempts) {
      this._endWordGame(false);
    }
  },

  _endWordGame: function (won) {
    var message = won
      ? (this._common.winMessage || "You win!").replace("{player}", "You")
      : this._common.loseMessage || "Game Over!";
    if (!won && this._subType === "hangman" && this._word) {
      message += " Word: " + this._word;
    }
    if (!won && this._subType === "wordle" && this._targetWord) {
      message += " Word: " + this._targetWord;
    }
    this.scene.start("TBGameOverScene", {
      winner: won ? { name: "You", score: 1 } : null,
      isDraw: false,
      scores: [{ name: "You", score: won ? 1 : 0 }],
      message: message,
    });
  },
});
