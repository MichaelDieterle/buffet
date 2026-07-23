module.exports = (sequelize, DataTypes) => {
  const Earning = sequelize.define('Earning', {
    reportDate: DataTypes.DATE,
    dateLow: DataTypes.DATE,
    dateHigh: DataTypes.DATE,
    isEstimate: DataTypes.BOOLEAN,
    epsEstimate: DataTypes.FLOAT,
    epsLow: DataTypes.FLOAT,
    epsHigh: DataTypes.FLOAT,
    epsActual: DataTypes.FLOAT,
    revenueEstimate: DataTypes.BIGINT,
    revenueLow: DataTypes.BIGINT,
    revenueHigh: DataTypes.BIGINT,
    revenueActual: DataTypes.BIGINT,
    quarter: DataTypes.STRING,
  }, {
    timestamps: true,
    indexes: [
      { unique: true, fields: ['stockId', 'reportDate'] }
    ],
  });

  Earning.associate = (models) => {
    Earning.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return Earning;
};
