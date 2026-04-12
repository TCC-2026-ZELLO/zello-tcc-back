const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'Zello123!';
  const saltRounds = 10;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Senha original:', password);
  console.log('Hash gerado:', hash);
}

generateHash();
