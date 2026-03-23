const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    process.exit(1);
  }
}

console.log('Starting Project Setup...');

run('npm install');

console.log('Checking Supabase status...');
let isRunning = false;
let statusCheckOutput = '';

try {
  statusCheckOutput = execSync('npx supabase status', { encoding: 'utf-8', stdio: 'pipe' });
} catch (error) {
  statusCheckOutput = error.stdout ? error.stdout.toString() : '';
}

const cleanStatusCheck = statusCheckOutput.replace(/\x1b\[[0-9;]*m/g, '');

if (cleanStatusCheck.includes('Project URL')) {
  isRunning = true;
  console.log('Supabase is already running smoothly.');
}

if (!isRunning) {
  console.log('Starting Supabase... This might take a minute.');
  try {
    execSync('npx supabase start', { stdio: 'inherit' });
  } catch (error) {
    console.log('\nWarning: Container conflict detected. Cleaning up and retrying...');
    execSync('npx supabase stop', { stdio: 'inherit' });
    execSync('npx supabase start', { stdio: 'inherit' });
  }
}

console.log('Extracting Supabase Credentials...');
let statusOutput = '';
try {
  statusOutput = execSync('npx supabase status', { encoding: 'utf-8' });
} catch (error) {
  console.error('Failed to get Supabase status. Make sure Docker is running.');
  process.exit(1);
}

// Strip out any invisible terminal color codes
const cleanOutput = statusOutput.replace(/\x1b\[[0-9;]*m/g, '');

// Use looser matching to catch the values reliably
const apiUrlMatch = cleanOutput.match(/Project URL[\s│]+(http[^\s│]+)/);
const anonKeyMatch = cleanOutput.match(/Publishable[\s│]+([a-zA-Z0-9._-]+)/);

if (!apiUrlMatch || !anonKeyMatch) {
  console.log('\n--- Debug: Could not find credentials in this output ---');
  console.log(cleanOutput);
  console.log('------------------------------------------------------\n');
}

if (apiUrlMatch && anonKeyMatch) {
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
    console.log('Updating existing .env.local file...');
  } else {
    console.log('Creating new .env.local file...');
  }

  if (envContent.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
    envContent = envContent.replace(/NEXT_PUBLIC_SUPABASE_URL=.*/g, `NEXT_PUBLIC_SUPABASE_URL=${apiUrlMatch[1]}`);
  } else {
    envContent += `\nNEXT_PUBLIC_SUPABASE_URL=${apiUrlMatch[1]}`;
  }

  if (envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    envContent = envContent.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKeyMatch[1]}`);
  } else {
    envContent += `\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKeyMatch[1]}`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('Credentials successfully written to .env.local');
} else {
  console.log('Warning: Could not automatically extract credentials.');
}

console.log('Running database migrations...');
try {
  execSync('npx supabase db reset', { stdio: 'inherit' });
} catch (error) {
  console.log('Warning: Database reset failed or was interrupted.');
}

console.log('Setup Complete!');
console.log('You can now run "npm run dev" to start your Next.js server.');