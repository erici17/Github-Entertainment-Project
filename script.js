window.addEventListener('load', function(){

    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    const CW = canvas.width;
    const CH = canvas.height;

    // HUD and overlay elements
    const hudCoins = document.getElementById('coins');
    const hudAbility = document.getElementById('ability');
    const hudSkeletons = document.getElementById('skeletons');
    const messageEl = document.getElementById('message');

    const startScreen = document.getElementById('startScreen');
    const btnStart = document.getElementById('btnStart');
    const levelComplete = document.getElementById('levelComplete');
    const btnNextLevel = document.getElementById('btnNextLevel');
    const nextInfo = document.getElementById('nextInfo');
    const gameOver = document.getElementById('gameOver');
    const btnRestart = document.getElementById('btnRestart');
    const gameOverInfo = document.getElementById('gameOverInfo');
    const victory = document.getElementById('victory');
    const btnPlayAgain = document.getElementById('btnPlayAgain');
    const pauseScreen = document.getElementById('pauseScreen');
    const btnResume = document.getElementById('btnResume');

    // Game states
    let state = 'start'; // 'start','playing','levelComplete','gameOver','victory','paused'

    class InputHandler {
        constructor(){
            this.keys = {};
            window.addEventListener('keydown', (e) => { this.keys[e.code] = true; if (e.code === 'Escape') togglePause(); });
            window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        }
    }

    class Player {
        constructor(x,y){
            this.x = x; this.y = y;
            this.w = 28; this.h = 48;
            this.vx = 0; this.vy = 0;
            this.speed = 3.2; this.jumpForce = 11;
            this.onGround = false;
            this.coins = 0;
            this.hasAbility = false;
            this.shootCooldown = 0;
            this.maxHealth = 5; this.health = this.maxHealth;
        }
        reset(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.onGround=false; this.coins=0; this.hasAbility=false; this.shootCooldown=0; this.health=this.maxHealth; }
    update(input, world){
        if (input.keys['ArrowLeft']) this.vx = -this.speed;
        else if (input.keys['ArrowRight']) this.vx = this.speed;
        else this.vx = 0;
        if (input.keys['Space'] && this.onGround){ this.vy = -this.jumpForce; this.onGround = false; }
        this.vy += 0.7; // gravity
        this.x += this.vx;
        this.y += this.vy;
        const groundY = world.groundY - this.h;
        if (this.y >= groundY){ this.y = groundY; this.vy = 0; this.onGround = true; }
        if (this.x < 0) this.x = 0;
        if (this.x > world.width - this.w) this.x = world.width - this.w;
        if (this.shootCooldown > 0) this.shootCooldown -= 1/60;
    }
    draw(ctx, camX){
        const dx = Math.round(this.x - camX);
        const dy = Math.round(this.y);
        // Head
        ctx.beginPath();
        ctx.arc(dx + this.w/2, dy - this.h, 10, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.beginPath();
        ctx.moveTo(dx + this.w/2, dy - this.h + 10);
        ctx.lineTo(dx + this.w/2, dy);
        ctx.stroke();
        // arms
        ctx.beginPath();
        ctx.moveTo(dx + this.w/2, dy - this.h + 20);
        ctx.lineTo(dx + this.w/2 - 10, dy - this.h + 40);
        ctx.moveTo(dx + this.w/2, dy - this.h + 20);
        ctx.lineTo(dx + this.w/2 + 10, dy - this.h + 40);
        ctx.stroke();
        // legs
        ctx.beginPath();
        ctx.moveTo(dx + this.w/2, dy);
        ctx.lineTo(dx + this.w/2 - 10, dy + 20);
        ctx.moveTo(dx + this.w/2, dy);
        ctx.lineTo(dx + this.w/2 + 10, dy + 20);
        ctx.stroke();
        // ability aura
        if (this.hasAbility){ ctx.fillStyle='rgba(255,140,0,0.6)'; ctx.fillRect(dx-6, dy - this.h - 4, this.w+12, 6); }
        // health bar
        const healthW = 60; const per = this.health / this.maxHealth; ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(8,8, healthW+4, 14);
        ctx.fillStyle='red'; ctx.fillRect(10, 10, healthW * per, 10);
    }
}

    class Coin { constructor(x,y){ this.x=x; this.y=y; this.r=8; this.collected=false;} draw(ctx, camX){ if (this.collected) return; ctx.fillStyle='gold'; ctx.beginPath(); ctx.arc(this.x-camX, this.y, this.r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.stroke(); }}
    class PowerUp { constructor(x,y){ this.x=x; this.y=y; this.r=12; this.collected=false;} draw(ctx, camX){ if (this.collected) return; ctx.fillStyle='orangered'; ctx.beginPath(); ctx.arc(this.x-camX, this.y, this.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='yellow'; ctx.fillRect(this.x-camX-4, this.y-4, 8,8); }}

    class Skeleton {
        constructor(x,y,opts={range:120,speed:1}){ this.x=x; this.y=y; this.w=28; this.h=40; this.startX=x; this.range=opts.range; this.dir=1; this.speed=opts.speed; this.dead=false; }
        update(){ if (this.dead) return; this.x += this.speed * this.dir; if (Math.abs(this.x - this.startX) > this.range) this.dir *= -1; }
        draw(ctx, camX){ if (this.dead) return; const dx = this.x - camX; ctx.fillStyle='#ddd'; ctx.fillRect(dx, this.y - this.h, this.w, this.h); ctx.strokeStyle='#222'; ctx.strokeRect(dx, this.y - this.h, this.w, this.h); }
    }

    class Boss {
        constructor(x,y,opts={health:12}){ this.x=x; this.y=y; this.w=80; this.h=80; this.health=opts.health; this.dir=1; this.speed=1.2; this.dead=false; this.fireCooldown=0; }
        update(world){ if (this.dead) return; this.x += this.speed * this.dir; if (this.x < world.bossArea.x || this.x > world.bossArea.x + world.bossArea.w - this.w) this.dir *= -1; if (this.fireCooldown>0) this.fireCooldown -= 1/60; else { this.fireCooldown = 1.2; const dir = (Math.random()>0.5?1:-1); world.fireballs.push(new Fireball(this.x + this.w/2, this.y - 20, dir, 3)); }}
        draw(ctx, camX){ if (this.dead) return; const dx = this.x - camX; ctx.fillStyle = '#8b5'; ctx.fillRect(dx, this.y - this.h, this.w, this.h); ctx.fillStyle='#000'; ctx.fillRect(dx+8, this.y - this.h + 10, this.w-16, 12); // eyes
            // boss health bar
            ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(dx, this.y - this.h - 14, this.w, 10); ctx.fillStyle='red'; ctx.fillRect(dx, this.y - this.h - 14, this.w * (this.health/ (this.maxHealth||this.health)), 10);
        }
    }

    class Fireball { constructor(x,y,dir,speed=6){ this.x=x; this.y=y; this.vx = speed*dir; this.r=8; this.ttl=300;} update(){ this.x += this.vx; this.ttl -= 1;} draw(ctx, camX){ ctx.fillStyle='orange'; ctx.beginPath(); ctx.arc(this.x-camX, this.y, this.r,0,Math.PI*2); ctx.fill(); }}

    class World {
        constructor(){ this.width = 2200; this.groundY = CH - 30; this.coins = []; this.powerups = []; this.skeletons = []; this.fireballs = []; this.boss = null; this.bossArea = {x:0,y:0,w:0}; }
        clear(){ this.coins = []; this.powerups = []; this.skeletons = []; this.fireballs = []; this.boss = null; }
        spawnLevel(level){ this.clear(); this.width = level.width; // coins
            for (let i=0;i<level.coinCount;i++){ const x = 120 + i * Math.max(80, level.width/level.coinCount) + (Math.random()*60-30); const y = this.groundY - 50 - ((i%3)*20); this.coins.push(new Coin(x,y)); }
            // powerups
            for (let i=0;i<level.powerupCount;i++){ const x = 400 + i * 600 + (Math.random()*120-60); this.powerups.push(new PowerUp(Math.min(this.width-120, x), this.groundY - 40 - (Math.random()*60))); }
            // skeleton enemies
            for (let i=0;i<level.skeletonCount;i++){ const x = 700 + i * (Math.max(140, level.width/Math.max(1,level.skeletonCount)) ) + (Math.random()*60-30); const s = new Skeleton(Math.min(this.width-100, x), this.groundY, { range: level.skeletonRange, speed: level.skeletonSpeed }); this.skeletons.push(s); }
            // boss if present
            if (level.hasBoss){ const bx = Math.max( this.width - 600, Math.floor(this.width*0.7)); const by = this.groundY; this.boss = new Boss(bx, by, {health: level.bossHealth}); this.boss.maxHealth = level.bossHealth; this.bossArea = {x: bx-300, y: 0, w: 600}; }
        }
        update(){ this.skeletons.forEach(s=>s.update()); if (this.boss) this.boss.update(this); this.fireballs.forEach(f=>f.update()); this.fireballs = this.fireballs.filter(f=>f.ttl>0 && f.x> -200 && f.x < this.width + 200); }
        drawBackground(ctx, camX){ // ground
            ctx.fillStyle='#2b2b2b'; ctx.fillRect(0, this.groundY, CW, CH - this.groundY);
            // simple distant layer
            ctx.fillStyle='rgba(30,60,30,0.18)'; ctx.fillRect(0, this.groundY-70, CW, 40);
        }
    }

    const input = new InputHandler();
    const world = new World();
    const player = new Player(80, world.groundY - 48);

    // Level definitions (5 levels, increasing difficulty)
    const levels = [
        { width:1600, coinCount:10, powerupCount:1, skeletonCount:2, skeletonRange:120, skeletonSpeed:1, hasBoss:false, bossHealth:0 },
        { width:1800, coinCount:12, powerupCount:1, skeletonCount:3, skeletonRange:140, skeletonSpeed:1.2, hasBoss:false, bossHealth:0 },
        { width:2000, coinCount:14, powerupCount:1, skeletonCount:4, skeletonRange:160, skeletonSpeed:1.4, hasBoss:false, bossHealth:0 },
        { width:2400, coinCount:16, powerupCount:2, skeletonCount:5, skeletonRange:180, skeletonSpeed:1.6, hasBoss:false, bossHealth:0 },
        { width:3000, coinCount:20, powerupCount:2, skeletonCount:6, skeletonRange:220, skeletonSpeed:1.8, hasBoss:true, bossHealth:18 }
    ];

    let currentLevel = 0;
    let camX = 0;

    function rectCollide(ax,ay,aw,ah, bx,by,bw,bh){ return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }

    function updateHUD(){ hudCoins.textContent = 'Coins: ' + player.coins; hudAbility.textContent = 'Ability: ' + (player.hasAbility? 'Fire' : 'None'); hudSkeletons.textContent = 'Skeletons: ' + world.skeletons.filter(s=>!s.dead).length + (world.boss && !world.boss.dead? ' + Boss' : ''); }

    function tryShoot(){ if (!player.hasAbility) return; if (player.shootCooldown > 0) return; const dir = (input.keys['ArrowLeft']? -1 : 1); const fb = new Fireball(player.x + (dir>0? player.w+6:-6), player.y+12, dir); world.fireballs.push(fb); player.shootCooldown = 0.35; }

    function showOverlay(el){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('visible')); if (el) el.classList.add('visible'); }

    function startLevel(index){ currentLevel = index; const lvl = levels[index]; world.spawnLevel(lvl); player.reset(80, world.groundY - player.h); camX = 0; state = 'playing'; showOverlay(null); }

    function onLevelComplete(){ state = 'levelComplete'; nextInfo.textContent = 'Completed level ' + (currentLevel+1) + '. Prepare for the next challenge.'; showOverlay(levelComplete); }

    function onGameOver(){ state = 'gameOver'; gameOverInfo.textContent = 'You reached level ' + (currentLevel+1) + '. Try again.'; showOverlay(gameOver); }

    function onVictory(){ state = 'victory'; showOverlay(victory); }

    function togglePause(){ if (state === 'playing'){ state = 'paused'; showOverlay(pauseScreen); } else if (state === 'paused'){ state = 'playing'; showOverlay(null); } }

    // button events
    btnStart.addEventListener('click', ()=> startLevel(0));
    btnNextLevel.addEventListener('click', ()=>{ if (currentLevel < levels.length-1) startLevel(currentLevel+1); else onVictory(); });
    btnRestart.addEventListener('click', ()=> startLevel(0));
    btnPlayAgain.addEventListener('click', ()=> startLevel(0));
    btnResume.addEventListener('click', ()=>{ state = 'playing'; showOverlay(null); });

    // initialize start overlay
    showOverlay(startScreen);

    let last = performance.now();
    function animate(t){
        const dt = (t - last)/1000; last = t;
        if (state === 'playing'){
            player.update(input, world);
            world.update();

            camX = Math.max(0, Math.min(world.width - CW, player.x - CW/3));

            // coins
            world.coins.forEach(c=>{
                if (!c.collected && Math.hypot(c.x - (player.x+player.w/2), c.y - (player.y+player.h/2)) < 26){ c.collected = true; player.coins += 1; }
            });
            // powerups
            world.powerups.forEach(p=>{
                if (!p.collected && Math.hypot(p.x - (player.x+player.w/2), p.y - (player.y+player.h/2)) < 30){ p.collected = true; player.hasAbility = true; }
            });

            // fireball collisions with skeletons
            world.fireballs.forEach(f => {
                world.skeletons.forEach(s => {
                    if (s.dead) return;
                    if (Math.abs(f.x - s.x) < 28 && Math.abs(f.y - s.y) < 40){ s.dead = true; f.ttl = 0; }
                });
                // boss hit
                if (world.boss && !world.boss.dead){ if (Math.abs(f.x - (world.boss.x + world.boss.w/2)) < 60 && Math.abs(f.y - (world.boss.y - world.boss.h/2)) < 60){ world.boss.health -= 1; f.ttl = 0; if (world.boss.health <= 0) world.boss.dead = true; }}
            });

            // enemy touching player
            world.skeletons.forEach(s=>{ if (s.dead) return; if (rectCollide(player.x, player.y - player.h, player.w, player.h, s.x, s.y - s.h, s.w, s.h)){ // damage and knockback
                    player.health -= 1; s.dead = true; player.vx = -2 * s.dir; if (player.health <= 0) onGameOver(); }
            });
            if (world.boss && !world.boss.dead){ if (rectCollide(player.x, player.y - player.h, player.w, player.h, world.boss.x, world.boss.y - world.boss.h, world.boss.w, world.boss.h)){ player.health -= 2; player.vx = -4; if (player.health <= 0) onGameOver(); }}

            // shooting
            if (input.keys['Digit1']) tryShoot();

            updateHUD();

            // level complete condition: all skeletons dead and boss dead (if any)
            const enemyRemain = world.skeletons.filter(s=>!s.dead).length + (world.boss && !world.boss.dead ? 1 : 0);
            if (enemyRemain === 0){ // small delay then level complete
                onLevelComplete();
            }

            // keep player in world vertical bounds
            if (player.y > CH + 200){ onGameOver(); }
        }

        // render
        ctx.clearRect(0,0,CW,CH);
        world.drawBackground(ctx, camX);
        world.coins.forEach(c=>c.draw(ctx, camX));
        world.powerups.forEach(p=>p.draw(ctx, camX));
        world.skeletons.forEach(s=>s.draw(ctx, camX));
        if (world.boss) world.boss.draw(ctx, camX);
        world.fireballs.forEach(f=>f.draw(ctx, camX));
        player.draw(ctx, camX);

        // message when not playing
        if (state === 'start') messageEl.textContent = 'Press Start to play';
        else if (state === 'paused') messageEl.textContent = 'Paused';
        else messageEl.textContent = '';

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

});