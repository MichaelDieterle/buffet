const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [6, 128] },
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
    },
  });

  // Legacy user records are retained for non-destructive database compatibility.
  // Application authentication has been removed, so password hashing/verification
  // hooks are intentionally no longer part of the runtime model.
  User.associate = (models) => {
    User.hasOne(models.Portfolio, { foreignKey: 'userId', as: 'portfolio' });
  };

  return User;
};
