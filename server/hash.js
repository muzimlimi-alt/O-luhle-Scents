import bcrypt from 'bcryptjs'
const hash = await bcrypt.hash('adminPassword123', 12)
console.log(hash)
