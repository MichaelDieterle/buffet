module.exports = (sequelize, DataTypes) => {
  const PriceHistory = sequelize.define('PriceHistory', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    open: { type: DataTypes.FLOAT, allowNull: false },
    high: { type: DataTypes.FLOAT, allowNull: false },
    low: { type: DataTypes.FLOAT, allowNull: false },
    close: { type: DataTypes.FLOAT, allowNull: false },
    volume: { type: DataTypes.BIGINT, allowNull: false },
    adjClose: { type: DataTypes.FLOAT, field: 'adj_close' },
  }, { timestamps: false });

  PriceHistory.associate = (models) => {
    PriceHistory.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return PriceHistory;
};
