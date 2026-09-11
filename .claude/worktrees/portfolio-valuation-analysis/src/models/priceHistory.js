module.exports = (sequelize, DataTypes) => {
  const PriceHistory = sequelize.define('PriceHistory', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    open: { type: DataTypes.FLOAT, allowNull: false },
    high: { type: DataTypes.FLOAT, allowNull: false },
    low: { type: DataTypes.FLOAT, allowNull: false },
    close: { type: DataTypes.FLOAT, allowNull: false },
    volume: DataTypes.BIGINT,
    adjClose: DataTypes.FLOAT,
  }, {
    timestamps: false,
    indexes: [
      { unique: true, fields: ['stockId', 'date'] }
    ],
  });

  PriceHistory.associate = (models) => {
    PriceHistory.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return PriceHistory;
};
