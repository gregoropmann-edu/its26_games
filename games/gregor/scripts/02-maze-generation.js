function generateCleanMazeGrid(rows, cols) {
    rows = rows % 2 === 0 ? rows + 1 : rows;
    cols = cols % 2 === 0 ? cols + 1 : cols;
    MAP_ROWS = rows;
    MAP_COLS = cols;

    const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 0 || c === 0 || c === cols - 1) {
                grid[r][c] = 7;
            } else {
                grid[r][c] = 10;
            }
        }
    }

    const gateCol = Math.floor(cols / 2);
    for (let i = 0; i < 12; i++) {
        const tr = Math.floor(seededRandom() * 3) + 1;
        const tc = Math.floor(seededRandom() * (cols - 4)) + 2;
        if (Math.abs(tc - gateCol) > 3) {
            grid[tr][tc] = 7;
        }
    }

    grid[1][2] = 2;
    grid[1][3] = 2;
    grid[2][2] = 2;
    grid[2][3] = 2;

    const castleStartRow = 5;
    for (let c = 0; c < cols; c++) {
        grid[castleStartRow][c] = 1;
    }

    grid[castleStartRow][gateCol - 1] = 9;
    grid[castleStartRow][gateCol] = 9;
    grid[castleStartRow][gateCol + 1] = 9;

    const mazeStartRow = castleStartRow + 1;
    const mazeEndRow = rows - 2;

    function inMazeBounds(r, c) {
        return r >= mazeStartRow && r <= mazeEndRow && c >= 1 && c <= cols - 2;
    }

    const stack = [];
    const startCell = { r: mazeStartRow + 1, c: gateCol };
    grid[startCell.r][startCell.c] = 0;
    stack.push(startCell);

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = [];

        const dirs = [
            { dr: -2, dc: 0 },
            { dr: 2, dc: 0 },
            { dr: 0, dc: -2 },
            { dr: 0, dc: 2 }
        ];

        for (let d of dirs) {
            const nr = current.r + d.dr;
            const nc = current.c + d.dc;
            if (inMazeBounds(nr, nc) && grid[nr][nc] === 1) {
                neighbors.push({ r: nr, c: nc, dr: d.dr, dc: d.dc });
            }
        }

        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(seededRandom() * neighbors.length)];
            grid[current.r + next.dr / 2][current.c + next.dc / 2] = 0;
            grid[next.r][next.c] = 0;
            stack.push({ r: next.r, c: next.c });
        } else {
            stack.pop();
        }
    }

    for (let r = castleStartRow + 1; r <= mazeStartRow + 2; r++) {
        grid[r][gateCol] = 0;
        grid[r][gateCol - 1] = 0;
    }

    for (let r = mazeStartRow + 2; r < mazeEndRow; r += 3) {
        for (let c = 2; c < cols - 2; c += 3) {
            if (grid[r][c] === 1 && seededRandom() < 0.35) {
                grid[r][c] = 0;
            }
        }
    }

    // Add a handful of optional loops so layouts are less corridor-like on replay.
    for (let i = 0; i < 9; i++) {
        const rr = mazeStartRow + 2 + Math.floor(seededRandom() * Math.max(1, mazeEndRow - mazeStartRow - 3));
        const cc = 2 + Math.floor(seededRandom() * Math.max(1, cols - 4));
        if (grid[rr][cc] === 1 && (grid[rr-1][cc] === 0 || grid[rr+1][cc] === 0 || grid[rr][cc-1] === 0 || grid[rr][cc+1] === 0)) grid[rr][cc] = 0;
    }

    const armoryR = Math.floor(rows * 0.4);
    const armoryC = cols - 4;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            grid[armoryR + dr][armoryC + dc] = 0;
        }
    }
    grid[armoryR][armoryC] = 5;
    grid[armoryR + 1][armoryC] = 6;
    grid[armoryR][armoryC - 2] = 4;

    const westR = Math.floor(rows * 0.4);
    const westC = 4;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            grid[westR + dr][westC + dc] = 0;
        }
    }
    grid[westR][westC] = 6;

    const sanctumR = rows - 4;
    const sanctumC = Math.floor(cols / 2);

    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
            const r = sanctumR + dr;
            const c = sanctumC + dc;
            if (r >= mazeStartRow && r < rows - 1 && c > 0 && c < cols - 1) {
                grid[r][c] = 0;
            }
        }
    }
    grid[sanctumR][sanctumC] = 3;

    for (let r = mazeStartRow + 2; r < rows - 2; r += 4) {
        for (let c = 2; c < cols - 2; c += 4) {
            if (grid[r][c] === 1 && (grid[r+1][c] === 0 || grid[r-1][c] === 0)) {
                grid[r][c] = 8;
            }
        }
    }

    return grid;
}

