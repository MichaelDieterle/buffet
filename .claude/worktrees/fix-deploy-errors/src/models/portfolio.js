const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Portfolio = sequelize.define('Portfolio', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  });

  Portfolio.associate = (models) => {
    Portfolio.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Portfolio.hasMany(models.Holding, { foreignKey: 'portfolioId', as: 'holdings' });
  };

  return Portfolio;
};
