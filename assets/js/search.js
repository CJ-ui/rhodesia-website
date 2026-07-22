// Generic client-side filter utility shared by the homepage service tiles
// and the news-page category chips. No dependencies, no network calls.
function filterCards(items, matches) {
  items.forEach(function (item) {
    item.classList.toggle("is-hidden", !matches(item));
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // --- Homepage service-tile search ---
  var searchForm = document.querySelector("[data-tile-search]");
  var tiles = Array.prototype.slice.call(document.querySelectorAll("[data-tile]"));

  if (searchForm && tiles.length) {
    var input = searchForm.querySelector("input[type='search']");

    var applyTileFilter = function () {
      var query = (input.value || "").trim().toLowerCase();
      filterCards(tiles, function (tile) {
        if (!query) return true;
        var keywords = (tile.getAttribute("data-keywords") || "").toLowerCase();
        return keywords.indexOf(query) !== -1;
      });
    };

    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      applyTileFilter();
    });

    input.addEventListener("input", applyTileFilter);
  }

  // --- News category filter chips ---
  var chips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-chip]"));
  var notices = Array.prototype.slice.call(document.querySelectorAll("[data-notice]"));

  if (chips.length && notices.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.setAttribute("aria-pressed", "false");
        });
        chip.setAttribute("aria-pressed", "true");

        var category = chip.getAttribute("data-filter-chip");
        filterCards(notices, function (notice) {
          return category === "all" || notice.getAttribute("data-category") === category;
        });
      });
    });
  }
});
