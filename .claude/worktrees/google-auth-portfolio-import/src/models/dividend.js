module.exports = (sequelize, DataTypes) => {
  const Dividend = sequelize.define('Dividend', {
    amount: DataTypes.FLOAT,
    currency: DataTypes.STRING,
    payDate: DataTypes.DATE,
    recordDate: DataTypes.DATE,
    exDate: DataTypes.DATE,
    declarationDate: DataTypes.DATE,
    frequency: DataTypes.STRING,
  }, {
    timestamps: true,
    indexes: [
      { unique: true, fields: ['stockId', 'exDate'] }
    ],
  });

  Dividend.associate = (models) => {
    Dividend.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return Dividend;
};
