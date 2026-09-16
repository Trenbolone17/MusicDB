const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { z } = require('zod');
const db = require('../db');
const { validationError } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const auth = require('../services/auth');
const { SELF_COLUMNS, toSelf, findSelfById, deleteAccount } = require('../services/users');
const storage = require('../storage');

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 256;

const ProfileSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Required').max(50, 'Use at most 50 characters').optional(),
    bio: z.string().trim().max(1000, 'Use at most 1000 characters').optional(),
  })
  .refine((values) => values.displayName !== undefined || values.bio !== undefined, { message: 'Nothing to change' });

const PasswordSchema = z.object({
  currentPassword: z.string('Required').min(1, 'Required'),
  newPassword: z.string('Required').min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
});

const DeleteSchema = z.object({ password: z.string('Required').min(1, 'Required') });

// The upload is held in memory, then decoded and re-encoded by sharp: that both shrinks it and
// guarantees what we store is a plain image, whatever the file claimed to be.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

const incorrectPassword = (field) => validationError('Incorrect password', { fields: { [field]: 'Incorrect password' } });

async function verifyCurrentPassword(userId, password, field) {
  const { rows } = await db.query('SELECT password_hash AS "passwordHash" FROM users WHERE id = $1', [userId]);
  if (!(await auth.verifyPassword(rows[0]?.passwordHash, password))) throw incorrectPassword(field);
}

// `sensitiveLimiter` slows down password guessing on the change-password and delete endpoints.
function createMeRouter({ sensitiveLimiter }) {
  const router = express.Router();
  router.use(requireAuth);

  router.patch('/', validateBody(ProfileSchema), async (req, res) => {
    const { rows } = await db.query(
      `UPDATE users
       SET display_name = coalesce($2, display_name), bio = coalesce($3, bio), updated_at = now()
       WHERE id = $1
       RETURNING ${SELF_COLUMNS}`,
      [req.user.id, req.body.displayName ?? null, req.body.bio ?? null],
    );
    res.json({ user: toSelf(rows[0]) });
  });

  router.put('/avatar', upload.single('avatar'), async (req, res) => {
    if (!req.file) throw validationError('Choose an image', { fields: { avatar: 'Choose an image' } });

    let image;
    try {
      image = await sharp(req.file.buffer)
        .rotate() // honour the EXIF orientation before it's stripped
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw validationError("That file isn't an image we can read", { fields: { avatar: 'Use a JPEG, PNG, or WebP image' } });
    }

    const key = `avatars/${req.user.id}-${crypto.randomBytes(8).toString('hex')}.webp`;
    await storage.put(key, image);
    const { rows } = await db.query(
      `UPDATE users AS u SET avatar_key = $2, updated_at = now()
       FROM (SELECT avatar_key AS previous_key FROM users WHERE id = $1) AS old
       WHERE u.id = $1
       RETURNING ${SELF_COLUMNS}, old.previous_key AS "oldKey"`,
      [req.user.id, key],
    );
    const { oldKey, ...user } = rows[0];
    if (oldKey) await storage.remove(oldKey).catch(() => {});
    res.json({ user: toSelf(user) });
  });

  // Changing the password signs out every other device: all refresh tokens go, and this
  // session gets a fresh one.
  router.put('/password', sensitiveLimiter, validateBody(PasswordSchema), async (req, res) => {
    await verifyCurrentPassword(req.user.id, req.body.currentPassword, 'currentPassword');
    const passwordHash = await auth.hashPassword(req.body.newPassword);

    const refreshToken = await db.withTransaction(async (client) => {
      await client.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [req.user.id, passwordHash]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
      return auth.issueRefreshToken(client, req.user.id);
    });
    auth.setRefreshCookie(res, refreshToken);
    res.json({ accessToken: auth.createAccessToken(req.user.id) });
  });

  router.delete('/', sensitiveLimiter, validateBody(DeleteSchema), async (req, res) => {
    await verifyCurrentPassword(req.user.id, req.body.password, 'password');
    const avatarKey = await deleteAccount(req.user.id);
    if (avatarKey) await storage.remove(avatarKey).catch(() => {});
    auth.clearRefreshCookie(res);
    res.status(204).end();
  });

  router.get('/', async (req, res) => {
    res.json({ user: await findSelfById(req.user.id) });
  });

  return router;
}

module.exports = { createMeRouter };
