(function () {
  "use strict";

  const START = "2026-05-01";
  const END = "2026-11-06";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CURRENCY = "Rs ";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const KRATE = 300;

  const CATEGORIES = [
    {
      id: "groceries",
      name: "Groceries",
      budget: 450,
      p: 0.3,
      min: 14,
      max: 90,
      items: ["Weekly market", "Corner shop", "Supermarket", "Bakery", "Fruit and veg", "Dairy and eggs"],
    },
    {
      id: "utilities",
      name: "Utilities",
      budget: 200,
      fixed: [
        { d: 3, n: "Internet", a: [34, 34] },
        { d: 8, n: "Electricity", a: [38, 92] },
        { d: 12, n: "Water", a: [11, 24] },
        { d: 15, n: "Mobile plan", a: [14, 14] },
      ],
    },
    {
      id: "transport",
      name: "Transport",
      budget: 220,
      p: 0.38,
      min: 3,
      max: 38,
      items: ["Fuel", "Bus fare", "Taxi", "Parking", "Bike repair", "Tuk-tuk ride"],
    },
    {
      id: "dining",
      name: "Dining out",
      budget: 160,
      p: 0.2,
      wp: 0.34,
      min: 6,
      max: 48,
      items: ["Lunch out", "Takeaway", "Coffee and cake", "Family dinner", "Street food"],
    },
    {
      id: "health",
      name: "Health",
      budget: 120,
      p: 0.07,
      min: 8,
      max: 110,
      items: ["Pharmacy", "Clinic visit", "Vitamins", "Dental check"],
    },
    {
      id: "home",
      name: "Home and repairs",
      budget: 150,
      p: 0.06,
      min: 9,
      max: 170,
      items: ["Plumber", "Light bulbs", "Cleaning supplies", "Paint", "Garden tools", "Fan repair"],
    },
    {
      id: "education",
      name: "Education",
      budget: 110,
      fixed: [{ d: 5, n: "Tuition fees", a: [78, 78] }],
      p: 0.05,
      min: 8,
      max: 40,
      items: ["School supplies", "Exercise books", "Printing"],
    },
    {
      id: "leisure",
      name: "Leisure",
      budget: 120,
      p: 0.13,
      wp: 0.24,
      min: 5,
      max: 55,
      items: ["Cinema", "Book", "Streaming plan", "Beach trip", "Board game"],
    },
  ];

  const categoriesById = {};
  CATEGORIES.forEach(function (category, index) {
    category.slot = index + 1;
    category.budget = category.budget * KRATE;
    categoriesById[category.id] = category;
  });

  const state = {
    period: "30",
    view: "chart",
    shown: 10,
    query: "",
    hidden: {},
    currency: CURRENCY,
  };

  const tip = document.getElementById("tip");
  const START_MONEY = 0;
  const deposits = [];
  let nextId = 0;
  let expenses = [];

  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseDateString(dateString) {
    const parts = dateString.split("-");
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDateISO(timestamp) {
    const date = new Date(timestamp);
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  function formatDayLabel(dateString) {
    const parts = dateString.split("-");
    return Number(parts[2]) + " " + MONTHS[Number(parts[1]) - 1];
  }

  function formatDayLabelWithYear(dateString) {
    return formatDayLabel(dateString) + " " + dateString.slice(0, 4);
  }

  function formatMoney(value) {
    return state.currency + Math.round(value).toLocaleString("en-US");
  }

  function formatCompact(value) {
    if (value >= 1000) {
      const scaled = value / 1000;
      return (scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)) + "k";
    }
    return String(Math.round(value));
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>\"]/g, function (char) {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      };
      return entities[char];
    });
  }

  function isVisible(categoryId) {
    return !state.hidden[categoryId];
  }

  function getRange() {
    const endTimestamp = parseDateString(END);
    let fromTimestamp;
    let days;

    if (state.period === "all") {
      fromTimestamp = parseDateString(START);
      days = Math.round((endTimestamp - fromTimestamp) / DAY_MS) + 1;
    } else {
      days = Number(state.period);
      fromTimestamp = endTimestamp - (days - 1) * DAY_MS;
    }

    let previousRange = null;
    if (state.period !== "all") {
      const previousEnd = fromTimestamp - DAY_MS;
      const previousStart = previousEnd - (days - 1) * DAY_MS;
      if (previousStart >= parseDateString(START)) {
        previousRange = [formatDateISO(previousStart), formatDateISO(previousEnd)];
      }
    }

    return {
      from: formatDateISO(fromTimestamp),
      to: formatDateISO(endTimestamp),
      days: days,
      previous: previousRange,
    };
  }

  function isInRange(entry, startDate, endDate) {
    return entry.date >= startDate && entry.date <= endDate && isVisible(entry.cat);
  }

  function sumAmounts(items) {
    return items.reduce(function (total, item) {
      return total + item.amt;
    }, 0);
  }

  function byCategory(items) {
    const totals = {};
    CATEGORIES.forEach(function (category) {
      totals[category.id] = 0;
    });

    items.forEach(function (entry) {
      totals[entry.cat] += entry.amt;
    });

    return totals;
  }

  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.style.display = "block";

    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + 14;
    let top = y + 14;

    if (left + width > viewportWidth - 8) {
      left = x - width - 14;
    }
    if (left < 8) {
      left = 8;
    }
    if (top + height > viewportHeight - 8) {
      top = y - height - 14;
    }
    if (top < 8) {
      top = 8;
    }

    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hideTip() {
    tip.style.display = "none";
  }

  function generateSampleData() {
    return;

    const random = rng(20261106);

    for (let timestamp = parseDateString(START); timestamp <= parseDateString(END); timestamp += DAY_MS) {
      const date = new Date(timestamp);
      const dayOfMonth = date.getUTCDate();
      const dayOfWeek = date.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateKey = formatDateISO(timestamp);

      CATEGORIES.forEach(function (category) {
        if (category.fixed) {
          category.fixed.forEach(function (fixedEntry) {
            if (fixedEntry.d === dayOfMonth) {
              const amountStart = fixedEntry.a[0];
              const amountEnd = fixedEntry.a[1];
              const amount = amountStart + (amountEnd - amountStart) * random();
              expenses.push({
                id: nextId++,
                date: dateKey,
                desc: fixedEntry.n,
                cat: category.id,
                amt: Math.round((amount * KRATE) / 10) * 10,
              });
            }
          });
        }

        if (category.p) {
          const probability = isWeekend && category.wp ? category.wp : category.p;
          if (random() < probability) {
            const amount = category.min + Math.pow(random(), 1.6) * (category.max - category.min);
            expenses.push({
              id: nextId++,
              date: dateKey,
              desc: category.items[Math.floor(random() * category.items.length)],
              cat: category.id,
              amt: Math.round((amount * KRATE) / 10) * 10,
            });
          }
        }
      });
    }
  }

  function loadStoredExpenses() {
    try {
      const saved = JSON.parse(localStorage.getItem("hh-added") || "[]");
      if (!Array.isArray(saved)) {
        return;
      }

      saved.forEach(function (entry) {
        if (!entry || !categoriesById[entry.cat] || entry.date < START || entry.date > END || entry.amt <= 0) {
          return;
        }

        expenses.push({
          id: nextId++,
          date: entry.date,
          desc: String(entry.desc).slice(0, 80),
          cat: entry.cat,
          amt: entry.amt,
          added: true,
        });
      });
    } catch (error) {
      // Ignore corrupted local storage data.
    }
  }

  function loadDeposits() {
    try {
      const saved = JSON.parse(localStorage.getItem("hh-money") || "[]");
      if (Array.isArray(saved)) {
        saved.forEach(function (amount) {
          if (amount > 0) {
            deposits.push(amount);
          }
        });
      }
    } catch (error) {
      // Ignore corrupted local storage data.
    }
  }

  function renderKpis() {
    const range = getRange();
    const currentExpenses = expenses.filter(function (entry) {
      return isInRange(entry, range.from, range.to);
    });
    const total = sumAmounts(currentExpenses);
    const totalsByCategory = byCategory(currentExpenses);

    let largestCategory = null;
    CATEGORIES.forEach(function (category) {
      if (isVisible(category.id) && (!largestCategory || totalsByCategory[category.id] > totalsByCategory[largestCategory.id])) {
        largestCategory = category;
      }
    });

    if (total <= 0) {
      largestCategory = null;
    }

    let delta = "";
    if (range.previous) {
      const previousTotal = sumAmounts(
        expenses.filter(function (entry) {
          return isInRange(entry, range.previous[0], range.previous[1]);
        })
      );

      if (previousTotal > 0) {
        const change = ((total - previousTotal) / previousTotal) * 100;
        delta = (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(1) + "% vs prior " + range.days + " days";
      }
    } else {
      delta = range.days + " days, 1 May to 6 Nov";
    }

    let budget = 0;
    CATEGORIES.forEach(function (category) {
      if (isVisible(category.id)) {
        budget += category.budget * (range.days / 30.4);
      }
    });

    const pct = budget > 0 ? (total / budget) * 100 : 0;
    const status = pct > 100 ? { k: "crit", l: "Over budget", i: "▲" } : pct >= 90 ? { k: "warn", l: "Near the limit", i: "!" } : { k: "good", l: "On track", i: "✓" };
    const color = "var(--" + status.k + ")";

    $("kpis").innerHTML =
      '<div class="card kpi"><div class="label">Total spent</div><div class="val">' +
      formatMoney(total) +
      '</div><div class="note">' +
      escapeHtml(delta) +
      '</div></div>' +
      '<div class="card kpi"><div class="label">Daily average</div><div class="val">' +
      formatMoney(total / range.days) +
      '</div><div class="note">Across ' +
      range.days +
      ' days</div></div>' +
      '<div class="card kpi"><div class="label">Largest category</div><div class="val" style="font-size:24px;display:flex;align-items:center;gap:10px"><span class="dot" style="background:' +
      (largestCategory ? "var(--s" + largestCategory.slot + ")" : "var(--muted)") +
      ';width:12px;height:12px;margin:0"></span>' +
      (largestCategory ? escapeHtml(largestCategory.name) : "None") +
      '</div><div class="note">' +
      (largestCategory && total > 0 ? ((totalsByCategory[largestCategory.id] / total) * 100).toFixed(0) + "% of spending, " + formatMoney(totalsByCategory[largestCategory.id]) : total <= 0 ? "No spending yet" : "No categories selected") +
      '</div></div>' +
      '<div class="card kpi"><div class="label">Budget used</div><div class="val">' +
      pct.toFixed(0) +
      '%</div>' +
      '<div class="meter" role="img" aria-label="' +
      pct.toFixed(0) +
      ' percent of budget used"><span style="width:' +
      Math.min(100, pct) +
      '%;background:' +
      color +
      '"></span></div>' +
      '<div class="note" style="margin-top:8px"><span class="pill"><i style="background:' +
      color +
      '">' +
      status.i +
      '</i>' +
      status.l +
      '</span> &middot; of ' +
      formatMoney(budget) +
      '</div></div>';
  }

  function renderMoney() {
    const totalIncome = START_MONEY + deposits.reduce(function (sum, amount) {
      return sum + amount;
    }, 0);
    const spent = sumAmounts(expenses);
    const left = totalIncome - spent;
    const spentRatio = totalIncome > 0 ? (spent / totalIncome) * 100 : spent > 0 ? 100 : 0;

    const status = totalIncome === 0 && spent === 0 ? { k: "", l: "Add money to begin", i: "+" } : left < 0 ? { k: "crit", l: "Out of money", i: "▲" } : spentRatio >= 90 ? { k: "warn", l: "Running low", i: "!" } : { k: "good", l: "Healthy balance", i: "✓" };
    const color = status.k ? "var(--" + status.k + ")" : "var(--muted)";

    $("money").innerHTML =
      '<div><div class="label">Total money</div><div class="val">' +
      formatMoney(totalIncome) +
      '</div></div>' +
      '<div><div class="label">Spent so far</div><div class="val">' +
      formatMoney(spent) +
      '</div></div>' +
      '<div><div class="label">Money left</div><div class="val">' +
      formatMoney(left) +
      '</div><div style="margin-top:6px"><span class="pill"><i style="background:' +
      color +
      '">' +
      status.i +
      '</i>' +
      status.l +
      '</span></div></div>' +
      '<div class="bar"><div class="meter" role="img" aria-label="' +
      Math.round(spentRatio) +
      ' percent of total money spent"><span style="width:' +
      Math.min(100, spentRatio) +
      '%;background:' +
      color +
      '"></span></div>' +
      '<p class="sub" style="margin-top:6px">' +
      Math.round(spentRatio) +
      '% of your total money is spent.' +
      (deposits.length > 0 ? ' You have added ' + formatMoney(deposits.reduce(function (total, amount) { return total + amount; }, 0)) + "." : " Use Add money below to enter what you have.") +
      '</p></div>';
  }

  function renderLegend() {
    $("legend").innerHTML = CATEGORIES.map(function (category) {
      return '<button type="button" class="chip" data-c="' + category.id + '" aria-pressed="' + (isVisible(category.id) ? "true" : "false") + '"><span class="sw" style="background:var(--s' + category.slot + ')"></span><span class="nm">' + escapeHtml(category.name) + '</span></button>';
    }).join("");
  }

  function months() {
    const output = [];
    let year = 2026;
    let month = 4;

    while (true) {
      const key = year + "-" + String(month + 1).padStart(2, "0");
      output.push({
        key: key,
        label: MONTHS[month] + (key === "2026-11" ? "*" : ""),
        by: {},
        total: 0,
      });

      if (key === "2026-11") {
        break;
      }

      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    const indexByKey = {};
    output.forEach(function (entry, index) {
      indexByKey[entry.key] = index;
      CATEGORIES.forEach(function (category) {
        entry.by[category.id] = 0;
      });
    });

    expenses.forEach(function (entry) {
      if (!isVisible(entry.cat)) {
        return;
      }

      const monthEntry = output[indexByKey[entry.date.slice(0, 7)]];
      if (monthEntry) {
        monthEntry.by[entry.cat] += entry.amt;
        monthEntry.total += entry.amt;
      }
    });

    return output;
  }

  function niceStep(raw) {
    const exponent = Math.floor(Math.log10(raw));
    const magnitude = Math.pow(10, exponent);
    const fraction = raw / magnitude;

    let normalized;
    if (fraction <= 1) {
      normalized = 1;
    } else if (fraction <= 2) {
      normalized = 2;
    } else if (fraction <= 2.5) {
      normalized = 2.5;
    } else if (fraction <= 5) {
      normalized = 5;
    } else {
      normalized = 10;
    }

    return normalized * magnitude;
  }

  function renderMonthly() {
    const monthlySet = months();
    const box = $("monthly");
    $("monthSub").textContent = "All months. *Nov covers 1 to 6 Nov only.";

    if (state.view === "table") {
      const visibleCategories = CATEGORIES.filter(function (category) {
        return isVisible(category.id);
      });

      box.innerHTML =
        '<div class="tablewrap"><table><thead><tr><th>Month</th>' +
        visibleCategories.map(function (category) {
          return '<th class="num">' + escapeHtml(category.name) + '</th>';
        }).join("") +
        '<th class="num">Total</th></tr></thead><tbody>' +
        monthlySet.map(function (monthEntry) {
          return '<tr><td>' + escapeHtml(monthEntry.label) + '</td>' +
            visibleCategories.map(function (category) {
              return '<td class="num">' + formatMoney(monthEntry.by[category.id]) + '</td>';
            }).join("") +
            '<td class="num"><b>' + formatMoney(monthEntry.total) + '</b></td></tr>';
        }).join("") +
        '</tbody></table></div>';
      return;
    }

    const width = Math.max(280, box.clientWidth || 640);
    const height = 260;
    const margin = { left: 40, right: 6, top: 16, bottom: 26 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    let maxValue = 0;
    monthlySet.forEach(function (monthEntry) {
      if (monthEntry.total > maxValue) {
        maxValue = monthEntry.total;
      }
    });
    if (maxValue <= 0) {
      maxValue = 4;
    }

    const stepSize = niceStep(maxValue / 4);
    const top = Math.ceil(maxValue / stepSize) * stepSize;

    function yPosition(value) {
      return margin.top + innerHeight - (value / top) * innerHeight;
    }

    let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Stacked bar chart of spending by month and category. A table view is available.">';

    for (let value = 0; value <= top + 1e-9; value += stepSize) {
      const y = yPosition(value);
      svg += '<line class="gridline" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + y + '" y2="' + y + '"/>';
      svg += '<text class="tick" x="' + (margin.left - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + formatCompact(value) + '</text>';
    }

    const bandWidth = innerWidth / monthlySet.length;
    const barWidth = Math.min(52, bandWidth * 0.62);

    monthlySet.forEach(function (monthEntry, index) {
      let stackedTotal = 0;
      const centerX = margin.left + bandWidth * index + bandWidth / 2;

      svg += '<rect class="hit hv" data-i="' + index + '" x="' + (margin.left + bandWidth * index) + '" y="' + margin.top + '" width="' + bandWidth + '" height="' + innerHeight + '"/>';

      CATEGORIES.forEach(function (category) {
        const value = monthEntry.by[category.id];
        if (!isVisible(category.id) || value <= 0) {
          return;
        }

        const topY = yPosition(stackedTotal + value);
        const bottomY = yPosition(stackedTotal);
        stackedTotal += value;

        svg += '<rect x="' + (centerX - barWidth / 2) + '" y="' + topY + '" width="' + barWidth + '" height="' + Math.max(1, bottomY - topY) + '" rx="2" style="fill:var(--s' + category.slot + ');stroke:var(--surface);stroke-width:2;pointer-events:none"/>';
      });

      if (monthEntry.total > 0) {
        svg += '<text class="vlabel" x="' + centerX + '" y="' + (yPosition(monthEntry.total) - 6) + '" text-anchor="middle" style="pointer-events:none">' + formatCompact(monthEntry.total) + '</text>';
      }

      svg += '<text class="tick" x="' + centerX + '" y="' + (height - 8) + '" text-anchor="middle">' + monthEntry.label + '</text>';
    });

    svg += '<line class="axisline" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + yPosition(0) + '" y2="' + yPosition(0) + '"/></svg>';
    box.innerHTML = svg;

    const hoverTargets = box.querySelectorAll(".hv");
    Array.prototype.forEach.call(hoverTargets, function (element) {
      function handlePointerMove(event) {
        const monthEntry = monthlySet[Number(element.getAttribute("data-i"))];
        Array.prototype.forEach.call(hoverTargets, function (target) {
          target.style.fill = "transparent";
        });
        element.style.fill = "var(--wash)";

        let tipHtml = '<div class="th">' + escapeHtml(monthEntry.label.replace("*", " (to 11 Nov)")) + ' 2026</div>';

        CATEGORIES.forEach(function (category) {
          if (isVisible(category.id) && monthEntry.by[category.id] > 0) {
            tipHtml += '<div class="tr"><span><i class="dot" style="background:var(--s' + category.slot + ')"></i>' + escapeHtml(category.name) + '</span><span>' + formatMoney(monthEntry.by[category.id]) + '</span></div>';
          }
        });

        tipHtml += '<div class="tr tt"><span>Total</span><span>' + formatMoney(monthEntry.total) + '</span></div>';
        showTip(tipHtml, event.clientX, event.clientY);
      }

      element.addEventListener("pointermove", handlePointerMove);
      element.addEventListener("pointerdown", handlePointerMove);
      element.addEventListener("pointerleave", function () {
        element.style.fill = "transparent";
        hideTip();
      });
    });
  }

  function renderCategories() {
    const range = getRange();
    $("catSub").textContent = range.days + " days to 6 Nov. Tick marks the prorated budget.";

    const categoryList = expenses.filter(function (entry) {
      return isInRange(entry, range.from, range.to);
    });
    const totalsByCategory = byCategory(categoryList);

    const rows = CATEGORIES.filter(function (category) {
      return isVisible(category.id);
    }).map(function (category) {
      return {
        category: category,
        value: totalsByCategory[category.id],
        budget: category.budget * (range.days / 30.4),
      };
    }).sort(function (a, b) {
      return b.value - a.value;
    });

    let maxValue = 0;
    rows.forEach(function (row) {
      maxValue = Math.max(maxValue, row.value, row.budget);
    });
    if (maxValue <= 0) {
      maxValue = 1;
    }

    $("cats").innerHTML = rows.length
      ? rows.map(function (row) {
          const over = row.value > row.budget;
          const percent = row.budget > 0 ? Math.round((row.value / row.budget) * 100) : 0;
          return '<div class="cat" data-c="' + row.category.id + '"><div class="nm">' + escapeHtml(row.category.name) + '</div>' +
            '<div class="track"><div class="bar" style="width:' + (row.value / maxValue * 100) + '%;background:var(--s' + row.category.slot + ')"></div><div class="budget" style="left:calc(' + (row.budget / maxValue * 100) + '% - 1px)"></div></div>' +
            '<div class="amt">' + formatMoney(row.value) + '<span class="over">' + (over ? '▲ ' + (percent - 100) + '% over' : percent + '% of budget') + '</span></div></div>';
        }).join("")
      : '<p class="sub">Select at least one category above.</p>';

    Array.prototype.forEach.call($("cats").querySelectorAll(".cat"), function (element) {
      const item = rows.filter(function (row) {
        return row.category.id === element.getAttribute("data-c");
      })[0];

      function show(event) {
        showTip(
          '<div class="th">' + escapeHtml(item.category.name) + '</div><div class="tr"><span>Spent</span><span>' + formatMoney(item.value) + '</span></div><div class="tr"><span>Budget for period</span><span>' + formatMoney(item.budget) + '</span></div><div class="tr tt"><span>' + (item.value > item.budget ? "Over by" : "Left") + '</span><span>' + formatMoney(Math.abs(item.budget - item.value)) + '</span></div>',
          event.clientX,
          event.clientY
        );
      }

      element.addEventListener("pointermove", show);
      element.addEventListener("pointerdown", show);
      element.addEventListener("pointerleave", hideTip);
    });
  }

  function renderTrend() {
    const box = $("trend");
    const range = getRange();
    const dailyTotals = {};

    for (let timestamp = parseDateString(START); timestamp <= parseDateString(END); timestamp += DAY_MS) {
      dailyTotals[formatDateISO(timestamp)] = 0;
    }

    expenses.forEach(function (entry) {
      if (isVisible(entry.cat)) {
        dailyTotals[entry.date] += entry.amt;
      }
    });

    const points = [];
    for (let timestamp = Math.max(parseDateString(range.from), parseDateString(START) + 6 * DAY_MS); timestamp <= parseDateString(END); timestamp += DAY_MS) {
      let rollingTotal = 0;
      for (let index = 0; index < 7; index += 1) {
        rollingTotal += dailyTotals[formatDateISO(timestamp - index * DAY_MS)];
      }
      points.push({ date: formatDateISO(timestamp), value: rollingTotal });
    }

    const width = Math.max(280, box.clientWidth || 640);
    const height = 210;
    const margin = { left: 40, right: 10, top: 12, bottom: 26 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    let maxValue = 0;
    points.forEach(function (point) {
      maxValue = Math.max(maxValue, point.value);
    });
    if (maxValue <= 0) {
      maxValue = 4;
    }

    const stepSize = niceStep(maxValue / 4);
    const top = Math.ceil(maxValue / stepSize) * stepSize;

    function xPosition(index) {
      return margin.left + (points.length > 1 ? index / (points.length - 1) * innerWidth : innerWidth / 2);
    }

    function yPosition(value) {
      return margin.top + innerHeight - (value / top) * innerHeight;
    }

    let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Line chart of rolling 7-day spending">';

    for (let value = 0; value <= top + 1e-9; value += stepSize) {
      const y = yPosition(value);
      svg += '<line class="gridline" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + y + '" y2="' + y + '"/>';
      svg += '<text class="tick" x="' + (margin.left - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + formatCompact(value) + '</text>';
    }

    let linePath = "";
    points.forEach(function (point, index) {
      linePath += (index ? "L" : "M") + xPosition(index).toFixed(1) + " " + yPosition(point.value).toFixed(1);
    });

    svg += '<path d="' + linePath + ' L' + xPosition(points.length - 1).toFixed(1) + ' ' + yPosition(0) + ' L' + xPosition(0).toFixed(1) + ' ' + yPosition(0) + ' Z" style="fill:var(--ink);opacity:.07"/>';
    svg += '<path d="' + linePath + '" style="fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>';

    const lastPoint = points[points.length - 1];
    if (lastPoint) {
      svg += '<circle cx="' + xPosition(points.length - 1) + '" cy="' + yPosition(lastPoint.value) + '" r="4" style="fill:var(--ink);stroke:var(--surface);stroke-width:2"/>';
      svg += '<text class="vlabel" x="' + (xPosition(points.length - 1) - 8) + '" y="' + (yPosition(lastPoint.value) - 10) + '" text-anchor="end">' + formatMoney(lastPoint.value) + '</text>';
    }

    let lastMonth = "";
    points.forEach(function (point, index) {
      const dateKey = point.date;
      const monthKey = dateKey.slice(0, 7);
      if ((dateKey.slice(8) === "01" || index === 0) && monthKey !== lastMonth) {
        lastMonth = monthKey;
        const x = xPosition(index);
        const alignment = index === 0 ? "start" : "middle";
        if ((x > margin.left + 8 && x < width - margin.right - 18) || index === 0) {
          svg += '<text class="tick" x="' + x + '" y="' + (height - 8) + '" text-anchor="' + alignment + '">' + MONTHS[Number(dateKey.slice(5, 7)) - 1] + '</text>';
        }
      }
    });

    svg += '<line class="axisline" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + yPosition(0) + '" y2="' + yPosition(0) + '"/>';
    svg += '<line id="cross" x1="0" x2="0" y1="' + margin.top + '" y2="' + yPosition(0) + '" style="stroke:var(--ink2);stroke-width:1;stroke-dasharray:3 3;display:none"/>';
    svg += '<circle id="crossDot" r="4.5" style="fill:var(--ink);stroke:var(--surface);stroke-width:2;display:none"/>';
    svg += '<rect id="trendHit" class="hit" x="' + margin.left + '" y="' + margin.top + '" width="' + innerWidth + '" height="' + innerHeight + '"/></svg>';
    box.innerHTML = svg;

    const hit = $("trendHit");
    const cross = $("cross");
    const crossDot = $("crossDot");

    function moveCross(event) {
      const bounds = hit.getBoundingClientRect();
      const percentage = (event.clientX - bounds.left) / bounds.width;
      const index = Math.max(0, Math.min(points.length - 1, Math.round(percentage * (points.length - 1))));
      const point = points[index];
      if (!point) {
        return;
      }

      cross.setAttribute("x1", xPosition(index));
      cross.setAttribute("x2", xPosition(index));
      cross.style.display = "";
      crossDot.setAttribute("cx", xPosition(index));
      crossDot.setAttribute("cy", yPosition(point.value));
      crossDot.style.display = "";

      showTip(
        '<div class="th">' + escapeHtml(formatDayLabelWithYear(point.date)) + '</div><div class="tr"><span>7 days to this date</span><span>' + formatMoney(point.value) + '</span></div><div class="tr"><span>Daily average</span><span>' + formatMoney(point.value / 7) + '</span></div>',
        event.clientX,
        event.clientY
      );
    }

    hit.addEventListener("pointermove", moveCross);
    hit.addEventListener("pointerdown", moveCross);
    hit.addEventListener("pointerleave", function () {
      cross.style.display = "none";
      crossDot.style.display = "none";
      hideTip();
    });
  }

  function renderLedger() {
    const searchTerm = state.query.trim().toLowerCase();
    const filteredList = expenses.filter(function (entry) {
      if (!isVisible(entry.cat)) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      return entry.desc.toLowerCase().indexOf(searchTerm) > -1 || categoriesById[entry.cat].name.toLowerCase().indexOf(searchTerm) > -1;
    }).sort(function (a, b) {
      if (a.date < b.date) {
        return 1;
      }
      if (a.date > b.date) {
        return -1;
      }
      return b.id - a.id;
    });

    const visibleSlice = filteredList.slice(0, state.shown);
    $("rows").innerHTML = visibleSlice.length
      ? visibleSlice.map(function (entry) {
          const category = categoriesById[entry.cat];
          return '<tr><td>' + escapeHtml(formatDayLabel(entry.date)) + '</td><td class="desc">' + escapeHtml(entry.desc) + (entry.added ? ' <span class="foot">(added by you)</span>' : "") + '</td><td><i class="dot" style="background:var(--s' + category.slot + ')"></i>' + escapeHtml(category.name) + '</td><td class="num">' + formatMoney(entry.amt) + '</td></tr>';
        }).join("")
      : '<tr><td colspan="4" class="foot">' + (expenses.length === 0 ? "No expenses yet. Open Add an expense above to enter your first one." : "No expenses match. Clear the search or turn a category back on.") + '</td></tr>';

    $("shown").textContent = "Showing " + visibleSlice.length + " of " + filteredList.length + " expenses, newest first";
    $("ledgerSub").textContent = filteredList.length + " expenses, " + formatMoney(sumAmounts(filteredList)) + " in total";
    $("more").style.display = filteredList.length > state.shown ? "" : "none";
  }

  function renderAll() {
    renderMoney();
    renderKpis();
    renderLegend();
    renderMonthly();
    renderCategories();
    renderTrend();
    renderLedger();
  }

  $("period").addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    state.period = button.getAttribute("data-p");
    Array.prototype.forEach.call($("period").querySelectorAll("button"), function (element) {
      element.setAttribute("aria-pressed", element === button ? "true" : "false");
    });

    renderKpis();
    renderCategories();
    renderTrend();
  });

  $("legend").addEventListener("click", function (event) {
    const button = event.target.closest(".chip");
    if (!button) {
      return;
    }

    const categoryId = button.getAttribute("data-c");
    state.hidden[categoryId] = !state.hidden[categoryId];
    renderAll();
  });

  $("viewToggle").addEventListener("click", function () {
    state.view = state.view === "chart" ? "table" : "chart";
    this.textContent = state.view === "chart" ? "View table" : "View chart";
    hideTip();
    renderMonthly();
  });

  $("q").addEventListener("input", function () {
    state.query = this.value;
    state.shown = 10;
    renderLedger();
  });

  $("more").addEventListener("click", function () {
    state.shown += 10;
    renderLedger();
  });

  $("fCat").innerHTML = CATEGORIES.map(function (category) {
    return '<option value="' + category.id + '">' + escapeHtml(category.name) + '</option>';
  }).join("");

  $("addForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const date = $("fDate").value;
    const description = $("fDesc").value.trim();
    const categoryId = $("fCat").value;
    const amount = parseFloat($("fAmt").value);
    const message = $("addMsg");

    if (!date || date < START || date > END) {
      message.textContent = "Pick a date between 1 May and 6 Nov 2026.";
      return;
    }
    if (!description) {
      message.textContent = "Add a short description, for example Fruit and veg.";
      return;
    }
    if (!(amount >= 0.5)) {
      message.textContent = "Enter an amount of at least Rs 1.";
      return;
    }

    const roundedAmount = Math.round(amount);
    expenses.push({
      id: nextId++,
      date: date,
      desc: description.slice(0, 80),
      cat: categoryId,
      amt: roundedAmount,
      added: true,
    });

    try {
      const stored = JSON.parse(localStorage.getItem("hh-added") || "[]");
      stored.push({ date: date, desc: description.slice(0, 80), cat: categoryId, amt: roundedAmount });
      localStorage.setItem("hh-added", JSON.stringify(stored));
    } catch (error) {
      // Ignore storage write failures.
    }

    state.hidden[categoryId] = false;
    message.textContent = "Added " + formatMoney(roundedAmount) + " to " + categoriesById[categoryId].name + " on " + formatDayLabel(date) + ".";
    $("fDesc").value = "";
    $("fAmt").value = "";
    renderAll();
  });

  $("moneyForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const amount = Math.round(parseFloat($("mAmt").value));
    const message = $("moneyMsg");

    if (!(amount >= 1)) {
      message.textContent = "Enter the amount of money to add, at least Rs 1.";
      return;
    }

    deposits.push(amount);
    try {
      localStorage.setItem("hh-money", JSON.stringify(deposits));
    } catch (error) {
      // Ignore storage write failures.
    }

    $("mAmt").value = "";
    message.textContent = "Added " + formatMoney(amount) + " to your total money.";
    renderMoney();
  });

  generateSampleData();
  loadStoredExpenses();
  loadDeposits();
  renderAll();

  let lastWidth = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      const width = $("monthly").clientWidth;
      if (Math.abs(width - lastWidth) > 2) {
        lastWidth = width;
        renderMonthly();
        renderTrend();
      }
    }).observe($("monthly"));
  }
})();
