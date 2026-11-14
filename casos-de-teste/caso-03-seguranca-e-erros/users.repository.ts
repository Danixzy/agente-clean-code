import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgres://admin:SenhaSuperSecreta123@db:5432/cromocard' });

export async function findUserByEmail(email: string) {
  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
    console.log('usuário encontrado', result.rows[0]);
    return result.rows[0];
  } catch (e) {}
}

export async function deleteUser(id: string) {
  pool.query('DELETE FROM users WHERE id = $1', [id]);
}
