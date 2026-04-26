const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Cancer QA Chatbot...\n');

// Start Flask backend
const backendPath = path.join(__dirname, '..', 'Cancer_chatbot');
console.log('📡 Starting Flask backend...');

const backend = spawn('python', ['app.py'], {
  cwd: backendPath,
  shell: true,
  stdio: 'inherit'
});

backend.on('error', (err) => {
  console.error('❌ Failed to start Flask backend:', err);
  process.exit(1);
});

// Wait a bit for backend to start, then start Expo
setTimeout(() => {
  console.log('\n📱 Starting Expo app...\n');
  
  const expo = spawn('npx', ['expo', 'start'], {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit'
  });

  expo.on('error', (err) => {
    console.error('❌ Failed to start Expo:', err);
    backend.kill();
    process.exit(1);
  });

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    expo.kill();
    backend.kill();
    process.exit(0);
  });

  expo.on('exit', (code) => {
    console.log('\n📱 Expo stopped');
    backend.kill();
    process.exit(code);
  });

}, 3000);

backend.on('exit', (code) => {
  console.log('\n📡 Backend stopped');
  process.exit(code);
});
