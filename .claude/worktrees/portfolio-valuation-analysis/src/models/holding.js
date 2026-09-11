const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Holding = sequelize.define('Holding', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticker: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    quantity: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        isDecimal(value) {
          if (isNaN(parseFloat(value))) {
            throw new Error('Quantity must be a number');
          }
        },
      },
    },
    averagePrice: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        isDecimal(value) {
          if (isNaN(parseFloat(value))) {
            throw new Error('Average price must be a number');
          }
        },
      },
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
  });

  Holding.associate = (models) => {
    Holding.belongsTo(models.Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });
  };

  return Holding;
};
