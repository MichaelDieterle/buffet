const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        // Password is only required for non-OAuth users
        isPasswordValid(value) {
          if (!value && !this.googleId) {
            throw new Error('Password is required for accounts without Google authentication');
          }
        },
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
    },
  });

  // Hash password before saving
  User.beforeCreate(async (user) => {
    if (user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password') && user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }
  });

  // Helper method to verify password
  User.prototype.verifyPassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  User.associate = (models) => {
    User.hasOne(models.Portfolio, { foreignKey: 'userId', as: 'portfolio' });
  };

  return User;
};
